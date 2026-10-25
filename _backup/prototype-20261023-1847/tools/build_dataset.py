#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 `高中园/` 的 10 个 xls 生成原型数据集。

本期范围：只导入基础数据（学校/年级/版本/班级/学生/教师/任课）与成绩数据，
不生成评价任务、不做增值计算、不生成报告。

用法：
    python build_dataset.py
    python build_dataset.py --source ../../高中园 --output ../assets/js/mock/dataset.js
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import xlrd


# ---------------------------------------------------------------------------
# 固定定义
# ---------------------------------------------------------------------------

SCHOOL_DEFS = [
    # id, 简称, 全称, 编码, 管理员账号
    ("S01", "博雅高中", "深圳外国语学校博雅高中", "BYGZ", "byadmin"),
    ("S02", "弘知高中", "深圳外国语学校弘知高中", "HZGZ", "hzadmin"),
    ("S03", "理工高中", "深圳外国语学校理工高中", "LGGZ", "lgadmin"),
    ("S04", "致远高中", "深圳外国语学校致远高中", "ZYGZ", "zyadmin"),
]
SCHOOL_BY_ID = {s[0]: s for s in SCHOOL_DEFS}

SUBJECT_ORDER = [
    "语文", "数学", "英语", "日语", "俄语",
    "物理", "化学", "生物", "历史", "政治", "地理",
]
CORE_SUBJECTS = ["语文", "数学"]
LANGUAGE_SUBJECTS = ["英语", "日语", "俄语"]
FIRST_SUBJECTS = ["物理", "历史"]
SECOND_SUBJECTS = ["化学", "生物", "政治", "地理"]
ASSIGN_SUBJECTS = set(SUBJECT_ORDER)

RESELECT_SUBJECTS = set(SECOND_SUBJECTS)

# 源表任课数据更正（保留原始 Excel 不动，构建时覆盖）
TEACHER_ASSIGNMENT_FIXES = [
    {
        "schoolId": "S03",
        "class_num": 6,
        "subject": "政治",
        "name": "王雅薇",
        "account": "13787300108",
        "note": "理工高中高三6班政治任课教师补录",
    },
    {
        "schoolId": "S03",
        "class_num": 8,
        "subject": "政治",
        "name": "王雅薇",
        "account": "13787300108",
        "note": "理工高中高三8班政治任课教师补录",
    },
]


# ---------------------------------------------------------------------------
# 通用小工具
# ---------------------------------------------------------------------------

def cell_str(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def cell_num(value):
    if isinstance(value, (int, float)):
        return float(value)
    text = cell_str(value)
    if text in ("", "-", "—", "缺", "缺考", "无"):
        return None
    try:
        return float(text)
    except ValueError:
        return None


def class_number(raw):
    """把 1班 / 高三1班 / 高二12班 / 高三(1)班 统一成整数。"""
    text = cell_str(raw)
    if not text or "临时" in text:
        return None
    match = re.search(r"(\d+)", text)
    return int(match.group(1)) if match else None


def school_id_from_name(name: str) -> str:
    for sid, short, full, _, _ in SCHOOL_DEFS:
        if short in name or full in name:
            return sid
    raise ValueError(f"无法识别学校：{name}")


def subject_sort_key(subject: str):
    try:
        return SUBJECT_ORDER.index(subject)
    except ValueError:
        return 999


# ---------------------------------------------------------------------------
# 任课老师名单
# ---------------------------------------------------------------------------

def parse_teacher_workbook(path: Path):
    """返回 [(class_num, homeroom, homeroom_account, [(subject, name, account)])]。"""
    workbook = xlrd.open_workbook(str(path))
    sheet = workbook.sheet_by_index(0)

    header_row = None
    headers = []
    for row in range(min(8, sheet.nrows)):
        values = [cell_str(sheet.cell_value(row, col)) for col in range(sheet.ncols)]
        if "年级" in values and "班级" in values and "班主任" in values:
            header_row = row
            headers = values
            break
    if header_row is None:
        raise ValueError(f"任课表找不到表头：{path.name}")

    subject_cols = [(idx, head) for idx, head in enumerate(headers) if head in ASSIGN_SUBJECTS]

    rows = []
    for row in range(header_row + 1, sheet.nrows):
        values = [cell_str(sheet.cell_value(row, col)) for col in range(sheet.ncols)]
        if not any(values):
            continue
        number = class_number(values[1] if len(values) > 1 else "")
        if number is None:
            continue
        homeroom = values[2] if len(values) > 2 else ""
        homeroom_account = values[3] if len(values) > 3 else ""
        assignments = []
        for col, subject in subject_cols:
            name = values[col] if col < len(values) else ""
            account = values[col + 1] if col + 1 < len(values) else ""
            if not name or name in ("42", "懂你"):
                continue
            assignments.append({"subject": subject, "name": name, "account": account})
        rows.append({
            "class_num": number,
            "homeroom": homeroom,
            "homeroom_account": homeroom_account,
            "assignments": assignments,
        })
    return rows


def build_teacher_registry(school_id: str, rows):
    """按 (姓名, 账号) 去重，生成教师与班级任课关系。"""
    registry = {}

    def touch(name, account, subject=None, class_num=None, homeroom=False):
        if not name or name in ("42", "懂你"):
            return None
        key = (name, account or "")
        item = registry.setdefault(key, {
            "name": name,
            "account": account or "",
            "subjects": set(),
            "homeroom_classes": set(),
        })
        if subject:
            item["subjects"].add(subject)
        if subject and class_num is not None:
            item.setdefault("class_subjects", set()).add((class_num, subject))
        if homeroom and class_num is not None:
            item["homeroom_classes"].add(class_num)
        return key

    for row in rows:
        if row["homeroom"]:
            touch(row["homeroom"], row["homeroom_account"], class_num=row["class_num"], homeroom=True)
        for assignment in row["assignments"]:
            touch(
                assignment["name"],
                assignment["account"],
                subject=assignment["subject"],
                class_num=row["class_num"],
            )

    teachers = []
    for key, item in registry.items():
        subjects = sorted(item["subjects"], key=subject_sort_key)
        if not subjects:
            subject = "未标注"
        else:
            subject = "、".join(subjects)
        teachers.append({
            "schoolId": school_id,
            "name": item["name"],
            "account": item["account"],
            "subject": subject,
            "subjects": subjects,
            "homeroomClasses": sorted(item["homeroom_classes"]),
            "classSubjects": sorted(
                item.get("class_subjects", set()),
                key=lambda pair: (pair[0], subject_sort_key(pair[1])),
            ),
        })

    teachers.sort(key=lambda t: (t["name"], t["account"]))
    return teachers


# ---------------------------------------------------------------------------
# 成绩单
# ---------------------------------------------------------------------------

def parse_score_workbook(path: Path):
    """解析成绩单，返回 [{school, name, class, studentNo, subjects: {subject: {raw, assigned}}}]。"""
    workbook = xlrd.open_workbook(str(path))
    sheet = workbook.sheet_by_index(0)
    if sheet.nrows < 3:
        return []

    top = [cell_str(sheet.cell_value(0, col)) for col in range(sheet.ncols)]
    sub = [cell_str(sheet.cell_value(1, col)) for col in range(sheet.ncols)]

    groups = []
    current = None
    for col in range(sheet.ncols):
        if top[col]:
            current = {"subject": top[col], "cols": {}}
            groups.append(current)
        if current is not None:
            current["cols"].setdefault(sub[col] or f"c{col}", []).append(col)

    rows = []
    for row in range(2, sheet.nrows):
        values = [sheet.cell_value(row, col) for col in range(sheet.ncols)]
        if not any(cell_str(value) for value in values):
            continue

        record = {
            "school": cell_str(values[0]),
            "name": cell_str(values[1]),
            "class": cell_str(values[2]),
            "studentNo": cell_str(values[3]),
            "examNo": cell_str(values[4]) if len(values) > 4 else "",
            "subjects": {},
        }

        for group in groups:
            subject = group["subject"]
            if subject in ("学校", "姓名", "班级", "学号", "考号", "学籍号", "总分"):
                continue
            cols = group["cols"]
            raw = None
            assigned = None
            if "得分" in cols:
                raw = cell_num(values[cols["得分"][0]])
            elif "原始分" in cols:
                raw = cell_num(values[cols["原始分"][0]])
            if "赋分" in cols:
                assigned = cell_num(values[cols["赋分"][0]])
            if raw is not None or assigned is not None:
                record["subjects"][subject] = {"raw": raw, "assigned": assigned}

        if record["studentNo"]:
            rows.append(record)

    return rows


def merge_exam_rows(raw_rows, assigned_rows):
    """以原始分文件为主，把赋分文件里的赋分合并进来。"""
    assigned_map = {row["studentNo"]: row for row in assigned_rows}
    merged = []
    for row in raw_rows:
        assigned = assigned_map.get(row["studentNo"], {})
        for subject, values in assigned.get("subjects", {}).items():
            target = row["subjects"].setdefault(subject, {"raw": None, "assigned": None})
            if target.get("assigned") is None:
                target["assigned"] = values.get("assigned")
            if target.get("raw") is None:
                target["raw"] = values.get("raw")
        merged.append(row)
    return merged


# ---------------------------------------------------------------------------
# 学生选择科目
# ---------------------------------------------------------------------------

def present_language(record):
    for subject in LANGUAGE_SUBJECTS:
        if record.get("subjects", {}).get(subject, {}).get("raw") is not None:
            return subject
    return None


def present_first(record):
    for subject in FIRST_SUBJECTS:
        if record.get("subjects", {}).get(subject, {}).get("raw") is not None:
            return subject
    return None


def present_seconds(record):
    return [
        subject for subject in SECOND_SUBJECTS
        if record.get("subjects", {}).get(subject, {}).get("raw") is not None
    ]


def has_any_score(record):
    return any(values.get("raw") is not None for values in record.get("subjects", {}).values())


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def apply_teacher_assignment_fixes(teacher_rows):
    """在解析后的任课表上应用人工更正；不修改原始 Excel。"""
    applied = []
    for fix in TEACHER_ASSIGNMENT_FIXES:
        rows = teacher_rows.get(fix["schoolId"], [])
        row = next((item for item in rows if item["class_num"] == fix["class_num"]), None)
        if row is None:
            raise ValueError(f"找不到更正班级：{fix['schoolId']} {fix['class_num']}班")
        row["assignments"] = [item for item in row["assignments"] if item["subject"] != fix["subject"]]
        row["assignments"].append({
            "subject": fix["subject"],
            "name": fix["name"],
            "account": fix["account"],
        })
        applied.append(fix["note"])
    return applied


def build_dataset(source_dir: Path):
    teacher_workbooks = {
        "S01": source_dir / "博雅班级任课老师名单-全部.xls",
        "S02": source_dir / "弘知班级任课老师名单-全部.xls",
        "S03": source_dir / "理工班级任课老师名单-全部.xls",
        "S04": source_dir / "致远班级任课老师名单-全部.xls",
    }
    for sid, path in teacher_workbooks.items():
        if not path.exists():
            raise FileNotFoundError(path)

    # 1. 任课表
    teacher_rows = {}
    for sid, path in teacher_workbooks.items():
        teacher_rows[sid] = parse_teacher_workbook(path)
    applied_fixes = apply_teacher_assignment_fixes(teacher_rows)

    # 2. 成绩单
    exam_files = {
        "E1": {
            "raw": source_dir / "高二期末原始分.xls",
            "physics": source_dir / "高二期末物理类赋分.xls",
            "history": source_dir / "高二期末历史类赋分.xls",
        },
        "E2": {
            "raw": source_dir / "高三原始分.xls",
            "physics": source_dir / "高三物理类赋分.xls",
            "history": source_dir / "高三历史类赋分.xls",
        },
    }

    exam_rows = {}
    for exam_id, files in exam_files.items():
        raw_rows = parse_score_workbook(files["raw"])
        assigned_rows = (
            parse_score_workbook(files["physics"])
            + parse_score_workbook(files["history"])
        )
        exam_rows[exam_id] = merge_exam_rows(raw_rows, assigned_rows)

    # 3. 学校 / 年级 / 班级
    schools = [
        {
            "id": sid,
            "name": short,
            "fullName": full,
            "code": code,
            "admin": admin,
            "enabled": True,
            "city": "深圳市",
        }
        for sid, short, full, code, admin in SCHOOL_DEFS
    ]
    grades = [
        {
            "id": f"G{index + 1}",
            "schoolId": sid,
            "name": "2027届高三",
            "stage": "高中",
            "gradeLevel": "高三",
            "entryYear": 2024,
            "status": "在读",
            "dirty": False,
        }
        for index, (sid, *_rest) in enumerate(SCHOOL_DEFS)
    ]
    grade_by_school = {grade["schoolId"]: grade["id"] for grade in grades}

    # 4. 当前班级（高三）与历史班级（高二）
    current_classes = []
    historical_classes = []
    class_map = {}          # (exam_id, school_id, class_num) -> class id
    class_name_map = {}     # (exam_id, school_id, class_num) -> display name

    for exam_id, label in (("E2", "高三"), ("E1", "高二")):
        grouped = defaultdict(list)
        for row in exam_rows[exam_id]:
            sid = school_id_from_name(row["school"])
            number = class_number(row["class"])
            if number is None:
                continue
            grouped[(sid, number)].append(row)

        for (sid, number), students in sorted(
            grouped.items(),
            key=lambda item: (item[0][0], item[0][1]),
        ):
            prefix = "C" if exam_id == "E2" else "H"
            class_id = f"{prefix}{len(current_classes if exam_id == 'E2' else historical_classes) + 1:03d}"
            display = f"{label}{number}班"
            class_map[(exam_id, sid, number)] = class_id
            class_name_map[(exam_id, sid, number)] = display
            item = {
                "id": class_id,
                "schoolId": sid,
                "gradeId": grade_by_school[sid],
                "name": display,
                "homeroomTeacherId": None,
                "size": len(students),
                "classNum": number,
            }
            (current_classes if exam_id == "E2" else historical_classes).append(item)

    # 5. 教师
    all_teachers = []
    teacher_keys = {}  # (school_id, name, account) -> teacher id
    for sid, rows in teacher_rows.items():
        registry = build_teacher_registry(sid, rows)
        prefix = {
            "S01": "BY", "S02": "HZ", "S03": "LG", "S04": "ZY"
        }[sid]
        for index, item in enumerate(registry, start=1):
            tid = f"T{len(all_teachers) + 1:03d}"
            teacher_keys[(sid, item["name"], item["account"])] = tid
            all_teachers.append({
                "id": tid,
                "schoolId": sid,
                "name": item["name"],
                "employeeNo": f"{prefix}{index:03d}",
                "subject": item["subject"],
                "subjects": item["subjects"],
                "subjectGroup": "外语" if item["subject"] in LANGUAGE_SUBJECTS else "",
                "language": item["subject"] if item["subject"] in LANGUAGE_SUBJECTS else "",
                "homeroomClassId": None,
                "status": "在职",
                "account": item["account"],
            })

    # 班主任映射：任课表班级号 -> 当前班级 id
    current_class_by_school_class = {}
    for item in current_classes:
        current_class_by_school_class[(item["schoolId"], item["classNum"])] = item

    for teacher in all_teachers:
        sid = teacher["schoolId"]
        registry = next(
            (item for item in build_teacher_registry(sid, teacher_rows[sid])
             if item["name"] == teacher["name"] and item["account"] == teacher["account"]),
            None,
        )
        if not registry:
            continue
        for number in registry["homeroomClasses"]:
            target = current_class_by_school_class.get((sid, number))
            if target:
                target["homeroomTeacherId"] = teacher["id"]
                teacher["homeroomClassId"] = target["id"]
                break

    # 6. 任课关系（当前高三）
    assignments = []
    for teacher in all_teachers:
        sid = teacher["schoolId"]
        registry = next(
            (item for item in build_teacher_registry(sid, teacher_rows[sid])
             if item["name"] == teacher["name"] and item["account"] == teacher["account"]),
            None,
        )
        if not registry:
            continue
        for number, subject in registry["classSubjects"]:
            target = current_class_by_school_class.get((sid, number))
            if not target:
                continue
            assignments.append({
                "id": f"A{len(assignments) + 1:04d}",
                "schoolId": sid,
                "classId": target["id"],
                "subject": subject,
                "teacherId": teacher["id"],
                "main": True,
            })

    # 同一班级同一科目若有多名教师，只保留第一位为主责
    seen_assignment = set()
    for assignment in assignments:
        key = (assignment["classId"], assignment["subject"])
        if key in seen_assignment:
            assignment["main"] = False
        else:
            seen_assignment.add(key)

    # 7. 学生
    current_students = []
    historical_students = []
    all_numbers = sorted(set(row["studentNo"] for row in exam_rows["E1"]) |
                         set(row["studentNo"] for row in exam_rows["E2"]))

    rows_by_no = {
        "E1": {row["studentNo"]: row for row in exam_rows["E1"]},
        "E2": {row["studentNo"]: row for row in exam_rows["E2"]},
    }

    for number in all_numbers:
        r1 = rows_by_no["E1"].get(number)
        r2 = rows_by_no["E2"].get(number)
        present = r1 or r2
        if not present:
            continue

        sid = school_id_from_name(present["school"])
        name = (r2 or r1)["name"]

        def bundle(record, fallback):
            """本场语种/首选/再选优先，缺失时用另一场补齐。"""
            if not (record and has_any_score(record)) and not (fallback and has_any_score(fallback)):
                return None, None, [], [], "—"
            language = present_language(record) if record else None
            language = language or (present_language(fallback) if fallback else None)
            first = present_first(record) if record else None
            first = first or (present_first(fallback) if fallback else None)
            seconds = present_seconds(record) if record else []
            if not seconds and fallback:
                seconds = present_seconds(fallback)
            subjects = CORE_SUBJECTS[:]
            if language:
                subjects.append(language)
            if first:
                subjects.append(first)
            subjects.extend(seconds)
            selection = "物理类" if first == "物理" else ("历史类" if first == "历史" else "—")
            return language, first, seconds, subjects, selection

        # 当前学生（高三）：以高三为主，高二补齐
        if r2:
            language, first, seconds, subjects, selection = bundle(r2, r1)
            class_num = class_number(r2["class"])
            current_class = current_class_by_school_class.get((sid, class_num))
            current_class_id = current_class["id"] if current_class else None
            current_class_name = current_class["name"] if current_class else r2["class"]
            homeroom_id = current_class["homeroomTeacherId"] if current_class else None
            class_by_exam = {"E2": current_class_id}
            if r1:
                hist_num = class_number(r1["class"])
                class_by_exam["E1"] = class_map.get(("E1", sid, hist_num))
            current_students.append({
                "id": number,
                "schoolId": sid,
                "gradeId": grade_by_school[sid],
                "studentNo": number,
                "name": name,
                "gender": "—",
                "classId": current_class_id,
                "className": current_class_name,
                "selection": selection,
                "firstSubject": first,
                "secondSubjects": seconds,
                "language": language,
                "subjects": subjects,
                "status": "在读",
                "homeroomTeacherId": homeroom_id,
                "classByExam": class_by_exam,
            })

        # 高二历史版本学生：以高二为主，高三补齐
        if r1:
            language, first, seconds, subjects, selection = bundle(r1, r2)
            class_num = class_number(r1["class"])
            hist_class_id = class_map.get(("E1", sid, class_num))
            hist_class_name = class_name_map.get(("E1", sid, class_num), r1["class"])
            class_by_exam = {"E1": hist_class_id}
            if r2:
                cur_num = class_number(r2["class"])
                class_by_exam["E2"] = class_map.get(("E2", sid, cur_num))
            historical_students.append({
                "id": number,
                "schoolId": sid,
                "gradeId": grade_by_school[sid],
                "studentNo": number,
                "name": name,
                "gender": "—",
                "classId": hist_class_id,
                "className": hist_class_name,
                "selection": selection,
                "firstSubject": first,
                "secondSubjects": seconds,
                "language": language,
                "subjects": subjects,
                "status": "在读",
                "homeroomTeacherId": None,
                "classByExam": class_by_exam,
            })

    # 8. 版本（V1 高二快照 / V2 高三当前）
    versions = []
    for index, (sid, *_rest) in enumerate(SCHOOL_DEFS):
        versions.append({
            "id": f"V{index * 2 + 1}",
            "schoolId": sid,
            "gradeId": grade_by_school[sid],
            "name": "高二期末（分班后）",
            "status": "已停用",
            "date": "2026-07-08",
            "publisher": "系统导入",
            "note": "高二期末成绩名单快照",
            "source": "导入生成",
            "current": False,
            "versionNo": 1,
        })
        versions.append({
            "id": f"V{index * 2 + 2}",
            "schoolId": sid,
            "gradeId": grade_by_school[sid],
            "name": "高三开学调整后",
            "status": "已保存",
            "date": "2026-09-01",
            "publisher": "系统导入",
            "note": "高三当前班级、学生、班主任与科任",
            "source": "导入生成",
            "current": True,
            "versionNo": 2,
        })

    # 9. 考试
    exams = [
        {
            "id": "E1",
            "name": "2024级高二期末联考（入口）",
            "date": "2026-07-08",
            "type": "联考",
            "stage": "高中",
            "gradeLevel": "高二",
            "status": "已发布",
            "schools": [sid for sid, *_ in SCHOOL_DEFS],
            "schoolConfig": {
                sid: {
                    "gradeId": grade_by_school[sid],
                    "versionId": f"V{index * 2 + 1}",
                    "gradeLabel": "2024级高二",
                }
                for index, (sid, *_rest) in enumerate(SCHOOL_DEFS)
            },
            "subjects": SUBJECT_ORDER[:],
            "note": "入口考试，使用高二期末原始分与赋分",
        },
        {
            "id": "E2",
            "name": "2024级高三联考（评价）",
            "date": "2026-10-15",
            "type": "联考",
            "stage": "高中",
            "gradeLevel": "高三",
            "status": "已发布",
            "schools": [sid for sid, *_ in SCHOOL_DEFS],
            "schoolConfig": {
                sid: {
                    "gradeId": grade_by_school[sid],
                    "versionId": f"V{index * 2 + 2}",
                    "gradeLabel": "2027届高三",
                }
                for index, (sid, *_rest) in enumerate(SCHOOL_DEFS)
            },
            "subjects": SUBJECT_ORDER[:],
            "note": "评价考试，使用高三原始分与赋分",
        },
    ]

    # 10. 成绩记录（含缺考）
    scores = []
    for exam_id in ("E1", "E2"):
        label = "高二" if exam_id == "E1" else "高三"
        for row in exam_rows[exam_id]:
            number = row["studentNo"]
            sid = school_id_from_name(row["school"])
            class_num = class_number(row["class"])
            class_id = class_map.get((exam_id, sid, class_num))
            class_name = class_name_map.get((exam_id, sid, class_num), row["class"])

            # 本场全科无成绩，且另一场也没有任何成绩：不生成成绩记录
            other = rows_by_no["E2" if exam_id == "E1" else "E1"].get(number)
            if not has_any_score(row) and not (other and has_any_score(other)):
                continue

            language = present_language(row)
            first = present_first(row)
            seconds = present_seconds(row)

            # 本场没有的语种/首选/再选，用另一场的选科补齐，仅用于“缺考”记录
            if not language and other:
                language = present_language(other)
            if not first and other:
                first = present_first(other)
            if not seconds and other:
                seconds = present_seconds(other)

            subjects = CORE_SUBJECTS[:]
            if language:
                subjects.append(language)
            if first:
                subjects.append(first)
            subjects.extend(seconds)

            for subject in subjects:
                values = row["subjects"].get(subject, {})
                raw = values.get("raw")
                assigned = values.get("assigned") if subject in RESELECT_SUBJECTS else None
                status = "正常" if raw is not None else "缺考"
                teacher_id = None
                if exam_id == "E2" and class_id:
                    hit = next(
                        (item for item in assignments
                         if item["classId"] == class_id and item["subject"] == subject and item["main"]),
                        None,
                    )
                    teacher_id = hit["teacherId"] if hit else None
                scores.append([
                    exam_id, number, number, row["name"], sid, class_id, class_name,
                    subject, raw, assigned, status, teacher_id,
                ])

    # 11. 导入批次
    import_batches = []
    for exam_id, label in (("E1", "高二期末"), ("E2", "高三")):
        for index, (sid, short, *_rest) in enumerate(SCHOOL_DEFS):
            count = sum(1 for row in exam_rows[exam_id] if school_id_from_name(row["school"]) == sid)
            import_batches.append({
                "id": f"IMP-{exam_id}-{sid}",
                "examId": exam_id,
                "schoolId": sid,
                "schoolName": short,
                "file": f"{short}_{label}成绩（原始分+赋分）.xls",
                "target": "成绩",
                "rows": count,
                "success": count,
                "skipped": 0,
                "failed": 0,
                "status": "已入库",
                "confidence": 99,
                "user": "系统导入",
                "time": "2026-07-08 18:00" if exam_id == "E1" else "2026-10-15 18:00",
            })

    # 教师账号只在构建期用于去重，不写入原型（避免手机号外泄）
    for teacher in all_teachers:
        teacher.pop("account", None)

    # 12. 快照
    v1_snapshots = {}
    for index, (sid, *_rest) in enumerate(SCHOOL_DEFS):
        v1_snapshots[f"V{index * 2 + 1}"] = {
            "classes": [item for item in historical_classes if item["schoolId"] == sid],
            "students": [item for item in historical_students if item["schoolId"] == sid],
        }

    dataset = {
        "meta": {
            "generatedAt": "2026-10-23",
            "phase": "evaluation",
            "confidential": True,
            "note": "内部演示数据，含真实学生姓名/学号，请勿公开传播。",
            "corrections": applied_fixes,
            "counts": {
                "schools": len(schools),
                "grades": len(grades),
                "versions": len(versions),
                "currentClasses": len(current_classes),
                "historicalClasses": len(historical_classes),
                "currentStudents": len(current_students),
                "historicalStudents": len(historical_students),
                "teachers": len(all_teachers),
                "assignments": len(assignments),
                "exams": len(exams),
                "scoreRecords": len(scores),
                "importBatches": len(import_batches),
            },
            "subjects": SUBJECT_ORDER,
        },
        "schools": schools,
        "grades": grades,
        "versions": versions,
        "classes": current_classes,
        "students": current_students,
        "teachers": all_teachers,
        "assignments": assignments,
        "exams": exams,
        "scores": scores,
        "importBatches": import_batches,
        "snapshots": v1_snapshots,
    }
    return dataset


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        default=str(Path(__file__).resolve().parents[3] / "高中园"),
        help="高中园 xls 目录",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "assets" / "js" / "mock" / "dataset.js"),
        help="输出 dataset.js",
    )
    args = parser.parse_args()

    source = Path(args.source)
    output = Path(args.output)
    dataset = build_dataset(source)

    output.parent.mkdir(parents=True, exist_ok=True)
    text = (
        "/* 高中园数据 · 由 build_dataset.py 生成，请勿手工修改。\n"
        " * 本期仅包含基础数据与成绩数据；不含评价任务/增值结果。\n"
        " * 内部演示数据，含真实姓名/学号，请勿公开传播。\n"
        " */\n"
        "window.DATASET = "
        + json.dumps(dataset, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    output.write_text(text, encoding="utf-8")

    summary = {
        "output": str(output),
        "sizeMB": round(output.stat().st_size / 1024 / 1024, 2),
        "corrections": dataset["meta"]["corrections"],
        **dataset["meta"]["counts"],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
