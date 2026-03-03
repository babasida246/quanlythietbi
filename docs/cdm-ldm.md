# CDM va LDM cho he thong QuanLyThietBi

Nguon doi chieu: `packages/infra-postgres/src/schema.sql` (trang thai hien tai).

## 1) CDM (Conceptual Data Model)

```mermaid
erDiagram
    NGUOI_DUNG {
      string user_id
      string vai_tro
    }

    NHA_CUNG_CAP {
      uuid vendor_id
      string ten
    }

    VI_TRI {
      uuid location_id
      string ten
      uuid parent_location_id
    }

    DANH_MUC_TAI_SAN {
      uuid category_id
      string ten
    }

    PHIEN_BAN_DAC_TA {
      uuid spec_version_id
      int version
      string trang_thai
    }

    TRUONG_DAC_TA {
      uuid spec_def_id
      string key
      string kieu_du_lieu
    }

    MAU_TAI_SAN {
      uuid model_id
      string model
      json thong_so
    }

    TAI_SAN {
      uuid asset_id
      string ma_tai_san
      string trang_thai
    }

    GAN_TAI_SAN {
      uuid assignment_id
      string doi_tuong_nhan
      datetime assigned_at
    }

    SU_KIEN_TAI_SAN {
      uuid event_id
      string loai_su_kien
      datetime created_at
    }

    PHIEU_BAO_TRI {
      uuid ticket_id
      string muc_do
      string trang_thai
    }

    NHAC_VIEC {
      uuid reminder_id
      string loai
      datetime due_at
    }

    YEU_CAU_WORKFLOW {
      uuid request_id
      string loai_yeu_cau
      string trang_thai
    }

    PHIEN_KIEM_KE {
      uuid session_id
      string ten
      string trang_thai
    }

    DONG_KIEM_KE {
      uuid item_id
      string trang_thai
      datetime scanned_at
    }

    KHO {
      uuid warehouse_id
      string ma_kho
      string ten_kho
    }

    LINH_KIEN {
      uuid part_id
      string ma_linh_kien
      string ten_linh_kien
    }

    TON_KHO {
      uuid stock_id
      int on_hand
      int reserved
    }

    CHUNG_TU_KHO {
      uuid document_id
      string loai_chung_tu
      string trang_thai
    }

    DONG_CHUNG_TU {
      uuid line_id
      int so_luong
      numeric don_gia
    }

    LENH_SUA_CHUA {
      uuid repair_order_id
      string code
      string trang_thai
    }

    LINH_KIEN_SUA_CHUA {
      uuid repair_part_id
      string action
      int qty
    }

    LOAI_CI {
      uuid ci_type_id
      string code
      string ten
    }

    CI {
      uuid ci_id
      string ci_code
      string ten
    }

    QUAN_HE_CI {
      uuid rel_id
      string rel_type
    }

    DICH_VU {
      uuid service_id
      string code
      string ten
    }

    DANH_MUC_TAI_SAN ||--o{ PHIEN_BAN_DAC_TA : "co"
    PHIEN_BAN_DAC_TA ||--o{ TRUONG_DAC_TA : "gom"
    DANH_MUC_TAI_SAN ||--o{ MAU_TAI_SAN : "phan_loai"
    PHIEN_BAN_DAC_TA ||--o{ MAU_TAI_SAN : "ap_dung"
    NHA_CUNG_CAP ||--o{ MAU_TAI_SAN : "cung_cap"

    MAU_TAI_SAN ||--o{ TAI_SAN : "xac_dinh"
    NHA_CUNG_CAP ||--o{ TAI_SAN : "mua_tu"
    VI_TRI ||--o{ TAI_SAN : "dat_tai"

    TAI_SAN ||--o{ GAN_TAI_SAN : "duoc_gan"
    TAI_SAN ||--o{ SU_KIEN_TAI_SAN : "phat_sinh"
    TAI_SAN ||--o{ PHIEU_BAO_TRI : "bao_tri"
    TAI_SAN ||--o{ NHAC_VIEC : "nhac_lich"
    TAI_SAN ||--o{ YEU_CAU_WORKFLOW : "workflow"

    PHIEN_KIEM_KE ||--o{ DONG_KIEM_KE : "gom"
    TAI_SAN ||--o{ DONG_KIEM_KE : "doi_chieu"
    VI_TRI ||--o{ DONG_KIEM_KE : "vi_tri_ky_vong_va_quet"

    KHO ||--o{ TON_KHO : "quan_ly"
    LINH_KIEN ||--o{ TON_KHO : "ton_theo"
    KHO ||--o{ CHUNG_TU_KHO : "phat_sinh"
    CHUNG_TU_KHO ||--o{ DONG_CHUNG_TU : "gom"
    LINH_KIEN ||--o{ DONG_CHUNG_TU : "xuat_nhap"

    TAI_SAN ||--o{ LENH_SUA_CHUA : "sua_chua"
    LENH_SUA_CHUA ||--o{ LINH_KIEN_SUA_CHUA : "su_dung_linh_kien"
    LINH_KIEN ||--o{ LINH_KIEN_SUA_CHUA : "duoc_dung"

    LOAI_CI ||--o{ CI : "dinh_nghia"
    TAI_SAN ||--o{ CI : "tham_chieu"
    VI_TRI ||--o{ CI : "trien_khai_tai"
    CI ||--o{ QUAN_HE_CI : "from_to"
    DICH_VU ||--o{ CI : "map_phu_thuoc"
```

## 2) LDM (Logical Data Model)

### 2.1 Asset, Catalog, Inventory, Workflow

```mermaid
erDiagram
    ASSET_CATEGORIES {
      uuid id PK
      varchar name
      timestamptz created_at
    }

    ASSET_CATEGORY_SPEC_VERSIONS {
      uuid id PK
      uuid category_id FK
      int version
      text status
      text created_by
      timestamptz created_at
    }

    ASSET_CATEGORY_SPEC_DEFS {
      uuid id PK
      uuid version_id FK
      text key
      text field_type
      bool required
      jsonb enum_values
      int sort_order
    }

    VENDORS {
      uuid id PK
      varchar name
      varchar tax_code
      varchar phone
      varchar email
    }

    LOCATIONS {
      uuid id PK
      varchar name
      uuid parent_id FK
      text path
      timestamptz created_at
    }

    ASSET_MODELS {
      uuid id PK
      uuid category_id FK
      uuid spec_version_id FK
      uuid vendor_id FK
      varchar brand
      varchar model
      jsonb spec
    }

    ASSETS {
      uuid id PK
      varchar asset_code UK
      uuid model_id FK
      uuid location_id FK
      uuid vendor_id FK
      varchar serial_no
      inet mgmt_ip
      varchar hostname
      varchar status
      date purchase_date
      date warranty_end
    }

    ASSET_ASSIGNMENTS {
      uuid id PK
      uuid asset_id FK
      varchar assignee_type
      varchar assignee_id
      varchar assignee_name
      timestamptz assigned_at
      timestamptz returned_at
    }

    ASSET_ATTACHMENTS {
      uuid id PK
      uuid asset_id FK
      text file_name
      text storage_key
      int version
      timestamptz created_at
    }

    ASSET_EVENTS {
      uuid id PK
      uuid asset_id FK
      varchar event_type
      jsonb payload
      varchar actor_user_id
      timestamptz created_at
    }

    INVENTORY_SESSIONS {
      uuid id PK
      text name
      uuid location_id FK
      text status
      timestamptz started_at
      timestamptz closed_at
    }

    INVENTORY_ITEMS {
      uuid id PK
      uuid session_id FK
      uuid asset_id FK
      uuid expected_location_id FK
      uuid scanned_location_id FK
      text status
      timestamptz scanned_at
    }

    MAINTENANCE_TICKETS {
      uuid id PK
      uuid asset_id FK
      varchar title
      varchar severity
      varchar status
      timestamptz opened_at
      timestamptz closed_at
    }

    REMINDERS {
      uuid id PK
      text reminder_type
      uuid asset_id FK
      timestamptz due_at
      text status
      text channel
    }

    WORKFLOW_REQUESTS {
      uuid id PK
      text request_type
      uuid asset_id FK
      text from_dept
      text to_dept
      text status
      jsonb payload
      timestamptz created_at
    }

    ASSET_CATEGORIES ||--o{ ASSET_CATEGORY_SPEC_VERSIONS : has
    ASSET_CATEGORY_SPEC_VERSIONS ||--o{ ASSET_CATEGORY_SPEC_DEFS : defines
    ASSET_CATEGORIES ||--o{ ASSET_MODELS : classifies
    ASSET_CATEGORY_SPEC_VERSIONS ||--o{ ASSET_MODELS : applied_to
    VENDORS ||--o{ ASSET_MODELS : provides

    ASSET_MODELS ||--o{ ASSETS : identified_by
    VENDORS ||--o{ ASSETS : purchased_from
    LOCATIONS ||--o{ ASSETS : located_at

    ASSETS ||--o{ ASSET_ASSIGNMENTS : assigned
    ASSETS ||--o{ ASSET_ATTACHMENTS : attached
    ASSETS ||--o{ ASSET_EVENTS : event_stream
    ASSETS ||--o{ MAINTENANCE_TICKETS : maintenance
    ASSETS ||--o{ REMINDERS : reminders
    ASSETS ||--o{ WORKFLOW_REQUESTS : workflow

    LOCATIONS ||--o{ INVENTORY_SESSIONS : scoped_to
    INVENTORY_SESSIONS ||--o{ INVENTORY_ITEMS : contains
    ASSETS ||--o{ INVENTORY_ITEMS : counted
    LOCATIONS ||--o{ INVENTORY_ITEMS : expected_location
    LOCATIONS ||--o{ INVENTORY_ITEMS : scanned_location
    LOCATIONS ||--o{ LOCATIONS : parent_child
```

### 2.2 Warehouse va Repair

```mermaid
erDiagram
    WAREHOUSES {
      uuid id PK
      text code UK
      text name
      uuid location_id FK
      timestamptz created_at
    }

    SPARE_PARTS {
      uuid id PK
      text part_code UK
      text name
      text category
      text uom
      text manufacturer
      text model
      jsonb spec
      int min_level
    }

    SPARE_PART_STOCK {
      uuid id PK
      uuid warehouse_id FK
      uuid part_id FK
      int on_hand
      int reserved
      timestamptz updated_at
    }

    SPARE_PART_MOVEMENTS {
      uuid id PK
      uuid warehouse_id FK
      uuid part_id FK
      text movement_type
      int qty
      numeric unit_cost
      text ref_type
      uuid ref_id
      timestamptz created_at
    }

    STOCK_DOCUMENTS {
      uuid id PK
      text doc_type
      text code UK
      text status
      uuid warehouse_id FK
      uuid target_warehouse_id FK
      date doc_date
      text ref_type
      uuid ref_id
      timestamptz created_at
    }

    STOCK_DOCUMENT_LINES {
      uuid id PK
      uuid document_id FK
      uuid part_id FK
      int qty
      numeric unit_cost
      text serial_no
      text adjust_direction
    }

    REPAIR_ORDERS {
      uuid id PK
      uuid asset_id FK
      text code UK
      text title
      text severity
      text status
      text repair_type
      uuid vendor_id FK
      numeric labor_cost
      numeric parts_cost
    }

    REPAIR_ORDER_PARTS {
      uuid id PK
      uuid repair_order_id FK
      uuid part_id FK
      uuid warehouse_id FK
      uuid stock_document_id FK
      text action
      int qty
      numeric unit_cost
    }

    LOCATIONS {
      uuid id PK
      varchar name
    }

    ASSETS {
      uuid id PK
      varchar asset_code
    }

    VENDORS {
      uuid id PK
      varchar name
    }

    LOCATIONS ||--o{ WAREHOUSES : placed_at
    WAREHOUSES ||--o{ SPARE_PART_STOCK : tracks
    SPARE_PARTS ||--o{ SPARE_PART_STOCK : stock_item

    WAREHOUSES ||--o{ SPARE_PART_MOVEMENTS : movement_at
    SPARE_PARTS ||--o{ SPARE_PART_MOVEMENTS : movement_of

    WAREHOUSES ||--o{ STOCK_DOCUMENTS : source_warehouse
    WAREHOUSES ||--o{ STOCK_DOCUMENTS : target_warehouse
    STOCK_DOCUMENTS ||--o{ STOCK_DOCUMENT_LINES : has_lines
    SPARE_PARTS ||--o{ STOCK_DOCUMENT_LINES : part_line

    ASSETS ||--o{ REPAIR_ORDERS : repaired_asset
    VENDORS ||--o{ REPAIR_ORDERS : service_vendor
    REPAIR_ORDERS ||--o{ REPAIR_ORDER_PARTS : part_usage
    SPARE_PARTS ||--o{ REPAIR_ORDER_PARTS : consumed_part
    WAREHOUSES ||--o{ REPAIR_ORDER_PARTS : issue_from
    STOCK_DOCUMENTS ||--o{ REPAIR_ORDER_PARTS : linked_doc
```

### 2.3 CMDB

```mermaid
erDiagram
    CMDB_CI_TYPES {
      uuid id PK
      varchar code UK
      varchar name
      text description
    }

    CMDB_CI_TYPE_VERSIONS {
      uuid id PK
      uuid type_id FK
      int version
      varchar status
      varchar created_by
      timestamptz created_at
    }

    CMDB_CI_SCHEMAS {
      uuid id PK
      uuid version_id FK
      varchar attr_key
      varchar attr_label
      varchar data_type
      bool is_required
      bool is_indexed
      jsonb validation_rules
      int display_order
    }

    CMDB_CIS {
      uuid id PK
      uuid type_id FK
      uuid asset_id FK
      uuid location_id FK
      varchar name
      varchar ci_code UK
      varchar status
      varchar environment
      varchar owner_team
      jsonb metadata
    }

    CMDB_CI_ATTR_VALUES {
      uuid id PK
      uuid ci_id FK
      uuid schema_id
      varchar attr_key
      jsonb value
      timestamptz updated_at
    }

    CMDB_RELATIONSHIP_TYPES {
      uuid id PK
      varchar code UK
      varchar name
      varchar reverse_name
      uuid allowed_from_type_id FK
      uuid allowed_to_type_id FK
    }

    CMDB_RELATIONSHIPS {
      uuid id PK
      uuid type_id FK
      uuid from_ci_id FK
      uuid to_ci_id FK
      jsonb metadata
      timestamptz created_at
    }

    CMDB_SERVICES {
      uuid id PK
      varchar code UK
      varchar name
      varchar criticality
      varchar owner
      varchar status
      jsonb sla
    }

    CMDB_SERVICE_CIS {
      uuid id PK
      uuid service_id FK
      uuid ci_id FK
      varchar dependency_type
      timestamptz created_at
    }

    ASSETS {
      uuid id PK
      varchar asset_code
    }

    LOCATIONS {
      uuid id PK
      varchar name
    }

    CMDB_CI_TYPES ||--o{ CMDB_CI_TYPE_VERSIONS : versioned
    CMDB_CI_TYPE_VERSIONS ||--o{ CMDB_CI_SCHEMAS : schema_fields

    CMDB_CI_TYPES ||--o{ CMDB_CIS : typed
    ASSETS ||--o{ CMDB_CIS : mapped_asset
    LOCATIONS ||--o{ CMDB_CIS : deployed_at

    CMDB_CIS ||--o{ CMDB_CI_ATTR_VALUES : has_values

    CMDB_CI_TYPES ||--o{ CMDB_RELATIONSHIP_TYPES : allowed_from
    CMDB_CI_TYPES ||--o{ CMDB_RELATIONSHIP_TYPES : allowed_to
    CMDB_RELATIONSHIP_TYPES ||--o{ CMDB_RELATIONSHIPS : relation_type
    CMDB_CIS ||--o{ CMDB_RELATIONSHIPS : from_ci
    CMDB_CIS ||--o{ CMDB_RELATIONSHIPS : to_ci

    CMDB_SERVICES ||--o{ CMDB_SERVICE_CIS : includes
    CMDB_CIS ||--o{ CMDB_SERVICE_CIS : supports
```

## 3) Luu y quan trong

- So do LDM ben tren uu tien cac bang nghiep vu thiet bi/CMDB/kho; cac bang chat/AI telemetry (`conversations`, `messages`, `model_configs`, `usage_logs`, ...) chua dua vao de tranh qua tai so do.
- Trong schema hien tai, mot so cot mang nghia tham chieu nhung khong rang buoc FK DB-level (vi du: `cmdb_ci_attr_values.schema_id`, `asset_events.actor_user_id`, `created_by`, `approved_by`).
- Neu ban can LDM full 100% toan bo schema (bao gom chat + AI + setup/auth chi tiet), co the tach them 1-2 so do bo sung de de doc.
