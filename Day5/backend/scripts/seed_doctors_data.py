"""
診療科ごとの医師シードデータ（Firestore doctors コレクション用）

予約可能時間（○）を表示するには:
  1) 本シードを実行: Day5/backend で run_seed_doctors.bat または python -m scripts.seed_doctors
  2) またはバックエンドで USE_DEMO_SLOTS=1 を設定（医師データなしで平日午前に○を表示）

masterData.js の診療科 label と完全一致させること。15分刻み 09:00〜16:45（フロント getTimeSlots と整合）。
"""
# 曜日キー: mon, tue, wed, thu, fri, sat, sun
# 時間: ["09:00", "09:15", "09:30", ...] 空配列は勤務なし

def _slots(start_h, start_m, end_h, end_m, step_minutes=15):
    """15分刻みの時間リストを生成（start 含む〜end 未満）"""
    out = []
    h, m = start_h, start_m
    while (h, m) < (end_h, end_m):
        out.append(f"{h:02d}:{m:02d}")
        m += step_minutes
        if m >= 60:
            h += 1
            m = 0
    return out


# 共通: 平日 9:00-12:00, 13:00-17:00（15分刻みで 16:45 まで）
WEEKDAY_MORNING = _slots(9, 0, 12, 0)   # 9:00〜11:45
WEEKDAY_AFTERNOON = _slots(13, 0, 17, 0)  # 13:00〜16:45
WEEKDAY_FULL = WEEKDAY_MORNING + WEEKDAY_AFTERNOON
WED_AM = _slots(9, 0, 12, 0)
FRI_AM = _slots(9, 0, 12, 0)

EMPTY = []

DOCTORS_SEED = [
    # 循環器内科
    {"id": "doc_cardiology_01", "name": "山田 太郎", "department": "循環器内科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": WED_AM, "thu": WEEKDAY_FULL, "fri": FRI_AM, "sat": EMPTY, "sun": EMPTY,
    }},
    {"id": "doc_cardiology_02", "name": "佐藤 花子", "department": "循環器内科", "schedules": {
        "mon": WEEKDAY_AFTERNOON, "tue": WEEKDAY_MORNING, "wed": WEEKDAY_FULL, "thu": EMPTY, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # 消化器内科
    {"id": "doc_gastro_01", "name": "鈴木 一郎", "department": "消化器内科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": EMPTY, "thu": WEEKDAY_FULL, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # 呼吸器内科
    {"id": "doc_respiratory_01", "name": "高橋 美咲", "department": "呼吸器内科", "schedules": {
        "mon": WEEKDAY_AFTERNOON, "tue": WEEKDAY_FULL, "wed": WEEKDAY_MORNING, "thu": WEEKDAY_AFTERNOON, "fri": WEEKDAY_MORNING, "sat": EMPTY, "sun": EMPTY,
    }},
    # 腎臓内科
    {"id": "doc_nephrology_01", "name": "伊藤 健", "department": "腎臓内科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": EMPTY, "wed": WEEKDAY_FULL, "thu": WEEKDAY_FULL, "fri": WEEKDAY_MORNING, "sat": EMPTY, "sun": EMPTY,
    }},
    # 神経内科
    {"id": "doc_neurology_01", "name": "渡辺 直子", "department": "神経内科", "schedules": {
        "mon": WEEKDAY_MORNING, "tue": WEEKDAY_FULL, "wed": WEEKDAY_AFTERNOON, "thu": WEEKDAY_FULL, "fri": WEEKDAY_AFTERNOON, "sat": EMPTY, "sun": EMPTY,
    }},
    # 整形外科
    {"id": "doc_ortho_01", "name": "中村 大輔", "department": "整形外科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": WEEKDAY_FULL, "thu": WEEKDAY_MORNING, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    {"id": "doc_ortho_02", "name": "小林 恵子", "department": "整形外科", "schedules": {
        "mon": EMPTY, "tue": WEEKDAY_AFTERNOON, "wed": WEEKDAY_MORNING, "thu": WEEKDAY_FULL, "fri": WEEKDAY_AFTERNOON, "sat": EMPTY, "sun": EMPTY,
    }},
    # 眼科
    {"id": "doc_ophthalmology_01", "name": "加藤 翔太", "department": "眼科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_MORNING, "wed": WEEKDAY_FULL, "thu": WEEKDAY_AFTERNOON, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # 耳鼻咽喉科
    {"id": "doc_oto_01", "name": "吉田 優", "department": "耳鼻咽喉科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": WEEKDAY_MORNING, "thu": WEEKDAY_FULL, "fri": WEEKDAY_AFTERNOON, "sat": EMPTY, "sun": EMPTY,
    }},
    # 皮膚科
    {"id": "doc_dermatology_01", "name": "松本 彩", "department": "皮膚科", "schedules": {
        "mon": WEEKDAY_AFTERNOON, "tue": WEEKDAY_FULL, "wed": WEEKDAY_FULL, "thu": WEEKDAY_MORNING, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # 泌尿器科
    {"id": "doc_urology_01", "name": "井上 誠", "department": "泌尿器科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_MORNING, "wed": WEEKDAY_AFTERNOON, "thu": WEEKDAY_FULL, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # 小児科
    {"id": "doc_pediatrics_01", "name": "木村 由美", "department": "小児科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": WEEKDAY_FULL, "thu": WEEKDAY_MORNING, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    {"id": "doc_pediatrics_02", "name": "林 拓也", "department": "小児科", "schedules": {
        "mon": EMPTY, "tue": WEEKDAY_AFTERNOON, "wed": WEEKDAY_MORNING, "thu": WEEKDAY_FULL, "fri": WEEKDAY_AFTERNOON, "sat": EMPTY, "sun": EMPTY,
    }},
    # 産婦人科
    {"id": "doc_obstetrics_01", "name": "斎藤 香織", "department": "産婦人科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_MORNING, "wed": WEEKDAY_FULL, "thu": WEEKDAY_AFTERNOON, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # 画像診断・検査
    {"id": "doc_radiology_01", "name": "山口 聡", "department": "画像診断・検査", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": WEEKDAY_FULL, "thu": WEEKDAY_FULL, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # 臨床検査
    {"id": "doc_lab_01", "name": "松田 裕子", "department": "臨床検査", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": WEEKDAY_FULL, "thu": WEEKDAY_FULL, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
    # リハビリテーション科
    {"id": "doc_rehab_01", "name": "石川 浩二", "department": "リハビリテーション科", "schedules": {
        "mon": WEEKDAY_FULL, "tue": WEEKDAY_FULL, "wed": WEEKDAY_FULL, "thu": WEEKDAY_FULL, "fri": WEEKDAY_FULL, "sat": EMPTY, "sun": EMPTY,
    }},
]
