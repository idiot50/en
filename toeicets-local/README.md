# TOEIC ETS — Bản clone local

Bản sao tĩnh của https://app.toeicets.com/ chạy hoàn toàn offline trên máy của bạn.

## Cách chạy

```powershell
cd d:\en\toeicets-local
python server.py
```

Sau đó mở trình duyệt: http://localhost:8000/

## Cấu trúc thư mục

```
toeicets-local/
├── server.py            # Python http server
├── download.ps1         # Script tải dữ liệu (đã chạy)
├── urls.txt             # 4.352 URL nguồn
├── download.log         # Log quá trình tải
└── public/
    ├── index.html       # Trang chủ
    ├── grammar.html     # Ngữ pháp
    ├── vocabulary.html  # Từ vựng
    ├── leaderboard.html # Bảng xếp hạng
    ├── more.html        # Tính năng khác
    ├── grammar-list.html
    ├── privacy.html
    ├── favicon.ico
    ├── _expo/static/js/web/entry-*.js   # JS bundle (đã rewrite URLs)
    ├── assets/                          # Font + icon + ảnh UI
    └── data/                            # 60 bộ đề TOEIC ETS
        ├── 2022/test1..test10/
        ├── 2023/test1..test10/
        ├── 2024/test1..test10/
        ├── 2025/test1..test10/
        ├── 2026/test1..test10/
        └── Economy/test1..test10/
            ├── audio/*.mp3
            ├── *.csv (câu hỏi)
            └── *.png/*.jpg (ảnh đề)
```

## Hạn chế của bản clone

| Có | Không |
|---|---|
| 60 bộ đề (audio + ảnh + câu hỏi) | Đăng nhập / tài khoản |
| Nội dung Grammar & Vocabulary | Bảng xếp hạng (cần backend) |
| Flashcards UI | Lưu tiến độ học |
| App chạy offline 100% | Thống kê lỗi sai cá nhân |

## Lưu ý bản quyền
Nội dung đề thi TOEIC thuộc Educational Testing Service (ETS).
Bản clone chỉ phục vụ **học cá nhân offline**, không phân phối lại.
