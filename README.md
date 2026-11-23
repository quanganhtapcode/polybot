# Poly Scanner

Dashboard tĩnh để lọc market Polymarket theo best ask, thể loại và thời gian.

## Triển khai

Vercel theo dõi nhánh `main` của repo. Mỗi commit lên `main` kích hoạt production deployment. Thư mục xuất bản là `dist` theo `vercel.json`.

Khi mở trang, trình duyệt tải bản dữ liệu trong `dist/snapshot.json` và làm mới trực tiếp qua Gamma API và CLOB API của Polymarket. Trang không cần biến môi trường hay backend riêng.
