<script lang="ts">
  import { FileText, Link2, Check, ChevronRight } from 'lucide-svelte';

  let { copyAnchor, copiedId = '' } = $props<{ copyAnchor: (id: string) => void; copiedId?: string }>();

  type ProcessStep = { step: string; role: string; detail: string; output: string };
  type BusinessProcess = {
    key: string;
    title: string;
    description: string;
    scope: string;
    triggers: string[];
    steps: ProcessStep[];
    kpi?: string[];
    exceptions?: string[];
  };

  const processes: BusinessProcess[] = [
    {
      key: 'asset-onboarding',
      title: 'QT-01: Tiếp nhận & Đăng ký tài sản mới',
      description: 'Quy trình chuẩn khi nhận thiết bị mới từ nhà cung cấp, kiểm tra, nhập kho và đăng ký vào hệ thống.',
      scope: 'Áp dụng cho tất cả thiết bị IT mới mua hoặc nhận tài trợ.',
      triggers: ['Nhận hàng từ NCC', 'Chuyển giao từ đơn vị khác', 'Nhận tài trợ/viện trợ'],
      steps: [
        { step: 'Tiếp nhận hàng hóa', role: 'Kho', detail: 'Nhận hàng từ NCC/vận chuyển. Kiểm tra số lượng theo đơn đặt hàng. Ký biên bản giao nhận.', output: 'Biên bản giao nhận' },
        { step: 'Kiểm tra chất lượng', role: 'Kỹ thuật', detail: 'Mở hộp, kiểm tra ngoại quan, bật nguồn test cơ bản. Đối chiếu serial number với invoice.', output: 'Phiếu kiểm tra QC' },
        { step: 'Nhập kho', role: 'Kho', detail: 'Tạo phiếu nhập kho trên hệ thống (Kho hàng → Phiếu → Nhập kho). Ghi nhận lô hàng, đơn giá.', output: 'Phiếu nhập kho' },
        { step: 'Đăng ký tài sản', role: 'Admin', detail: 'Vào Tài sản → + Thêm. Nhập mã tài sản theo quy ước, serial, model, ngày mua, bảo hành. Gán vị trí ban đầu.', output: 'Tài sản trên hệ thống (trạng thái: Trong kho)' },
        { step: 'Dán nhãn', role: 'Kho', detail: 'In và dán nhãn barcode/QR theo mã tài sản. Đặt thiết bị đúng vị trí kho.', output: 'Thiết bị có nhãn, sẵn sàng phân bổ' }
      ],
      kpi: ['Thời gian hoàn thành ≤ 2 ngày làm việc', 'Tỷ lệ kiểm tra QC pass ≥ 98%', '100% tài sản phải có mã và nhãn trước khi phân bổ'],
      exceptions: ['Thiết bị không đạt QC → lập biên bản, trả NCC, tạo ticket theo dõi.', 'Serial trùng → liên hệ NCC xác minh, không nhập hệ thống cho đến khi xác nhận.']
    },
    {
      key: 'asset-allocation',
      title: 'QT-02: Phân bổ & Gán tài sản',
      description: 'Quy trình gán tài sản từ kho cho người dùng, phòng ban hoặc hệ thống.',
      scope: 'Áp dụng khi cần cấp thiết bị cho nhân viên mới, thay thế, hoặc triển khai dự án.',
      triggers: ['Yêu cầu cấp phát từ phòng ban', 'Nhân viên mới', 'Thay thế thiết bị hỏng', 'Triển khai dự án'],
      steps: [
        { step: 'Tiếp nhận yêu cầu', role: 'Admin', detail: 'Nhận yêu cầu cấp phát (email, ticket hỗ trợ, hoặc quy trình nội bộ). Xác minh tính hợp lệ.', output: 'Yêu cầu được phê duyệt' },
        { step: 'Chọn thiết bị phù hợp', role: 'Admin', detail: 'Tìm kiếm trong kho thiết bị có trạng thái "Trong kho" phù hợp. Ưu tiên thiết bị FIFO.', output: 'Thiết bị được chọn' },
        { step: 'Chuẩn bị thiết bị', role: 'Kỹ thuật', detail: 'Cài đặt OS, phần mềm, cấu hình mạng. Gán license phần mềm trên hệ thống.', output: 'Thiết bị sẵn sàng sử dụng' },
        { step: 'Bàn giao & Gán', role: 'Admin', detail: 'Giao thiết bị cho người nhận. Trên hệ thống: Tài sản → Chi tiết → Gán → chọn người/phòng ban. Ký biên bản bàn giao.', output: 'Tài sản chuyển "Đang sử dụng"' },
        { step: 'Xác nhận', role: 'Người dùng', detail: 'Người nhận xác nhận đã nhận thiết bị, kiểm tra hoạt động.', output: 'Biên bản bàn giao có chữ ký' }
      ],
      kpi: ['Thời gian phân bổ ≤ 1 ngày làm việc (thiết bị biêu sẵn)', 'Tỷ lệ phân bổ đúng yêu cầu ≥ 95%'],
      exceptions: ['Không đủ tồn kho → kích hoạt QT mua sắm.', 'Yêu cầu đặc biệt (spec cao) → cần phê duyệt cấp quản lý.']
    },
    {
      key: 'asset-return',
      title: 'QT-03: Thu hồi & Trả tài sản',
      description: 'Quy trình khi nhân viên nghỉ việc, chuyển phòng ban, hoặc thiết bị hết nhu cầu sử dụng.',
      scope: 'Áp dụng khi cần thu hồi tài sản đang được gán.',
      triggers: ['Nhân viên nghỉ việc/chuyển công tác', 'Kết thúc dự án', 'Thiết bị hỏng cần thay thế', 'Yêu cầu thu hồi từ quản lý'],
      steps: [
        { step: 'Thông báo thu hồi', role: 'Admin', detail: 'Gửi thông báo cho người đang sử dụng về việc thu hồi thiết bị. Nêu rõ thời hạn trả.', output: 'Thông báo thu hồi' },
        { step: 'Người dùng trả thiết bị', role: 'Người dùng', detail: 'Backup dữ liệu cá nhân. Trả thiết bị và phụ kiện cho Admin/Kỹ thuật.', output: 'Thiết bị được trả' },
        { step: 'Kiểm tra tình trạng', role: 'Kỹ thuật', detail: 'Kiểm tra thiết bị: ngoại quan, hoạt động. Ghi nhận tình trạng (tốt/hỏng/thiếu phụ kiện).', output: 'Phiếu kiểm tra' },
        { step: 'Trả trên hệ thống', role: 'Admin', detail: 'Tài sản → Chi tiết → Trả. Nhập ghi chú trả lại. Hệ thống tự chuyển trạng thái.', output: 'Tài sản về trạng thái "Trong kho"' },
        { step: 'Xóa dữ liệu (nếu cần)', role: 'Kỹ thuật', detail: 'Wipe sạch dữ liệu, reset factory. Cài lại OS tiêu chuẩn.', output: 'Thiết bị sạch, sẵn sàng tái sử dụng' }
      ],
      kpi: ['Thời gian thu hồi ≤ 3 ngày sau thông báo', '100% thiết bị phải kiểm tra trước khi nhập lại kho'],
      exceptions: ['Thiết bị hỏng → chuyển qua QT sửa chữa (QT-04).', 'Thiết bị mất → tạo báo cáo mất, chuyển trạng thái "Mất".']
    },
    {
      key: 'asset-repair',
      title: 'QT-04: Sửa chữa & Bảo trì',
      description: 'Quy trình xử lý khi thiết bị gặp sự cố, từ phát hiện đến hoàn thành sửa chữa.',
      scope: 'Áp dụng cho tất cả sự cố thiết bị cần can thiệp kỹ thuật.',
      triggers: ['Người dùng báo lỗi', 'Phát hiện trong kiểm tra định kỳ', 'Alert từ hệ thống monitoring', 'Kết quả kiểm kê phát hiện bất thường'],
      steps: [
        { step: 'Tiếp nhận sự cố', role: 'Kỹ thuật', detail: 'Ghi nhận thông tin sự cố từ người báo. Xác định tài sản liên quan.', output: 'Phiếu yêu cầu sửa chữa' },
        { step: 'Tạo Work Order', role: 'Kỹ thuật', detail: 'Bảo trì → Đơn sửa chữa → + Tạo. Chọn tài sản, mô tả sự cố, severity. Hoặc bấm nút "Bảo trì" trên trang chi tiết tài sản.', output: 'WO trạng thái "open"' },
        { step: 'Chẩn đoán', role: 'Kỹ thuật', detail: 'Kiểm tra, test, phân tích nguyên nhân. Cập nhật WO: chẩn đoán, loại sửa chữa. Đổi trạng thái "diagnosing".', output: 'Chẩn đoán rõ ràng' },
        { step: 'Xuất kho linh kiện (nếu cần)', role: 'Kho', detail: 'Nếu cần thay linh kiện: tạo phiếu xuất kho. Đổi WO sang "waiting_parts". Khi có linh kiện: đổi sang "in_progress".', output: 'Phiếu xuất kho, linh kiện sẵn sàng' },
        { step: 'Thực hiện sửa chữa', role: 'Kỹ thuật', detail: 'Thay thế linh kiện, cài đặt lại, cập nhật firmware. Ghi nhận linh kiện đã dùng trong WO.', output: 'Thiết bị đã sửa' },
        { step: 'Kiểm tra kết quả', role: 'Kỹ thuật', detail: 'Test lại thiết bị. Nếu OK: đổi WO sang "repaired". Nếu chưa OK: quay lại chẩn đoán.', output: 'WO trạng thái "repaired"' },
        { step: 'Đóng Work Order', role: 'Quản lý', detail: 'Xác nhận kết quả sửa chữa. Ghi nhận chi phí (nhân công + linh kiện). Đổi WO sang "closed".', output: 'WO đóng, chi phí ghi nhận' },
        { step: 'Trả tài sản', role: 'Admin', detail: 'Nếu tài sản đang "in_repair": chuyển về "in_use" hoặc "in_stock" tùy tình huống.', output: 'Tài sản hoạt động bình thường' }
      ],
      kpi: ['Thời gian phản hồi sự cố ≤ 4 giờ', 'Thời gian sửa chữa trung bình ≤ 2 ngày', 'Tỷ lệ sửa thành công lần đầu ≥ 85%', 'Chi phí sửa chữa / giá trị tài sản ≤ 30%'],
      exceptions: ['Không sửa được → đề xuất thanh lý (QT-05).', 'Chi phí sửa > 50% giá trị → cần phê duyệt quản lý.', 'Sự cố bảo mật → ưu tiên xử lý + báo cáo incident.']
    },
    {
      key: 'asset-disposal',
      title: 'QT-05: Thanh lý & Loại bỏ tài sản',
      description: 'Quy trình khi tài sản hết thời hạn sử dụng, hỏng không sửa được, hoặc lỗi thời cần loại bỏ.',
      scope: 'Áp dụng cho thiết bị đã hết khấu hao, hỏng vĩnh viễn, hoặc không còn nhu cầu sử dụng.',
      triggers: ['Tài sản hết khấu hao', 'Không sửa được (kết luận từ QT-04)', 'Thiết bị lỗi thời', 'Quyết định thanh lý từ ban lãnh đạo'],
      steps: [
        { step: 'Đề xuất thanh lý', role: 'Kỹ thuật', detail: 'Lập danh sách tài sản đề xuất thanh lý. Ghi rõ lý do, tình trạng, giá trị còn lại.', output: 'Tờ trình thanh lý' },
        { step: 'Phê duyệt', role: 'Quản lý', detail: 'Xem xét danh sách, đánh giá tính hợp lý. Phê duyệt hoặc yêu cầu bổ sung.', output: 'Quyết định thanh lý' },
        { step: 'Xóa dữ liệu bảo mật', role: 'Kỹ thuật', detail: 'Xóa sạch tất cả dữ liệu trên thiết bị. Sử dụng phần mềm xóa an toàn hoặc hủy vật lý ổ cứng.', output: 'Biên bản xóa dữ liệu' },
        { step: 'Xử lý vật lý', role: 'Kho', detail: 'Thu hồi linh kiện còn tái sử dụng (RAM, HDD). Bàn giao thiết bị cho đơn vị thanh lý.', output: 'Biên bản thanh lý' },
        { step: 'Cập nhật hệ thống', role: 'Admin', detail: 'Chuyển trạng thái tài sản: Tài sản → Chi tiết → Đổi trạng thái → "Thanh lý/Loại bỏ". Thu hồi license phần mềm.', output: 'Tài sản ở trạng thái "disposed"' }
      ],
      kpi: ['Thời gian thanh lý ≤ 5 ngày làm việc', '100% dữ liệu phải được xóa trước thanh lý', 'Tỷ lệ tái sử dụng linh kiện ≥ 30%'],
      exceptions: ['Tài sản chưa hết hạn bảo hành → liên hệ NCC để bảo hành trước.', 'Tài sản chứa dữ liệu nhạy cảm → phải hủy ổ cứng vật lý.']
    },
    {
      key: 'inventory-audit',
      title: 'QT-06: Kiểm kê tài sản định kỳ',
      description: 'Quy trình kiểm kê đối soát giữa dữ liệu hệ thống và thực tế.',
      scope: 'Áp dụng cho kiểm kê định kỳ (hàng quý/năm) hoặc kiểm kê đột xuất.',
      triggers: ['Lịch kiểm kê định kỳ', 'Yêu cầu từ ban kiểm toán', 'Phát hiện sai sót', 'Thay đổi nhân sự phụ trách kho'],
      steps: [
        { step: 'Lập kế hoạch', role: 'Admin', detail: 'Xác định phạm vi (vị trí/loại tài sản), thời gian, nhân sự tham gia.', output: 'Kế hoạch kiểm kê' },
        { step: 'Tạo phiên kiểm kê', role: 'Admin', detail: 'Tài sản → Chi tiết bất kỳ → Tab Kiểm kê → Tạo phiên. Hoặc tạo nhiều phiên cho các vị trí khác nhau.', output: 'Phiên kiểm kê đang mở' },
        { step: 'Quét tài sản', role: 'Kỹ thuật', detail: 'Dùng scanner quét barcode/QR trên thiết bị. Hoặc nhập mã tài sản thủ công vào panel Quick Scan.', output: 'Danh sách tài sản đã quét' },
        { step: 'Đối soát', role: 'Admin', detail: 'So sánh danh sách quét với hệ thống. Xác định: đủ, thừa, thiếu, sai vị trí.', output: 'Báo cáo đối soát' },
        { step: 'Xử lý chênh lệch', role: 'Admin', detail: 'Tài sản thừa: đăng ký bổ sung. Thiếu: điều tra, báo mất. Sai vị trí: cập nhật.', output: 'Dữ liệu đã cập nhật' },
        { step: 'Đóng phiên & Báo cáo', role: 'Admin', detail: 'Đóng phiên kiểm kê. Tải evidence pack. Lập báo cáo kiểm kê.', output: 'Báo cáo kiểm kê hoàn chỉnh' }
      ],
      kpi: ['Tỷ lệ kiểm kê chính xác ≥ 98%', 'Hoàn thành kiểm kê trong 3 ngày', 'Xử lý chênh lệch trong 5 ngày'],
      exceptions: ['Tài sản không tìm thấy → lập biên bản, chuyển trạng thái "Mất" sau 7 ngày.', 'Tài sản không có nhãn → dán nhãn tại chỗ, cập nhật thông tin.']
    },
    {
      key: 'asset-procurement',
      title: 'QT-07: Mua sắm tài sản IT',
      description: 'Quy trình đề xuất, phê duyệt và mua sắm thiết bị mới khi không đủ tồn kho hoặc phát sinh nhu cầu.',
      scope: 'Áp dụng khi cần mua thiết bị mới, nâng cấp, hoặc bổ sung tồn kho dự phòng.',
      triggers: ['Tồn kho dự phòng xuống dưới ngưỡng tối thiểu', 'Yêu cầu từ phòng ban không đủ tồn kho', 'Kết quả kiểm kê phát hiện thiếu hụt', 'Lập kế hoạch mua sắm định kỳ'],
      steps: [
        { step: 'Lập đề xuất mua sắm', role: 'Admin / IT Manager', detail: 'Xác định danh sách thiết bị cần mua: loại, số lượng, thông số kỹ thuật tối thiểu. Căn cứ vào tồn kho hiện tại và nhu cầu dự báo.', output: 'Danh sách đề xuất mua sắm' },
        { step: 'Xin báo giá', role: 'Admin', detail: 'Liên hệ ít nhất 3 nhà cung cấp. Thu thập báo giá kèm điều khoản bảo hành, thanh toán, giao hàng.', output: 'Bảng so sánh báo giá' },
        { step: 'Phê duyệt ngân sách', role: 'Quản lý', detail: 'Trình bảng so sánh báo giá lên cấp phê duyệt. Lựa chọn nhà cung cấp tối ưu (giá + chất lượng + uy tín).', output: 'Quyết định mua sắm được phê duyệt' },
        { step: 'Đặt hàng', role: 'Admin', detail: 'Phát hành Purchase Order (PO). Ghi nhận số PO, ngày dự kiến giao hàng, điều khoản thanh toán.', output: 'Purchase Order' },
        { step: 'Theo dõi giao hàng', role: 'Admin', detail: 'Theo dõi tiến độ giao hàng. Xử lý nếu giao hàng trễ hoặc có vấn đề.', output: 'Xác nhận ngày giao hàng' },
        { step: 'Tiếp nhận & kiểm tra', role: 'Kho / Kỹ thuật', detail: 'Nhận hàng, kiểm tra theo PO. Chuyển sang QT-01 để nhập kho chính thức.', output: 'Hàng hóa sẵn sàng, chuyển QT-01' }
      ],
      kpi: ['Thời gian xử lý đơn hàng ≤ 5 ngày làm việc', 'Tỷ lệ giao hàng đúng hạn ≥ 90%', 'Tiết kiệm chi phí so với ngân sách ≥ 5%'],
      exceptions: ['NCC không đáp ứng spec → yêu cầu thay thế hoặc chuyển sang NCC khác.', 'Ngân sách không đủ → ưu tiên mua từng phần theo thứ tự cấp thiết.', 'Hàng giao không đúng → trả lại, lập biên bản, yêu cầu đổi.']
    },
    {
      key: 'cmdb-ci-registration',
      title: 'QT-08: Khám phá & Đăng ký CI vào CMDB',
      description: 'Quy trình đăng ký Configuration Item (CI) vào CMDB khi triển khai hệ thống, dịch vụ mới hoặc phát hiện CI chưa được quản lý.',
      scope: 'Áp dụng cho tất cả hạng mục cần quản lý trong CMDB: server, VM, network device, database, service, application.',
      triggers: ['Triển khai hệ thống/dịch vụ mới', 'Phát hiện CI chưa được đăng ký trong quá trình kiểm kê', 'Migration hoặc tái cấu trúc hạng mục', 'Yêu cầu từ audit/compliance'],
      steps: [
        { step: 'Xác định CI cần đăng ký', role: 'Kỹ thuật', detail: 'Liệt kê các hạng mục: tên, loại, môi trường (production/staging/dev). Đối chiếu với danh sách CI hiện có trong CMDB → CMDB → Hạng mục.', output: 'Danh sách CI cần đăng ký' },
        { step: 'Chọn/Tạo loại CI', role: 'Admin', detail: 'CMDB → Loại hạng mục → kiểm tra xem đã có loại phù hợp chưa. Nếu chưa: tạo loại mới với schema thuộc tính phù hợp (IP Address, OS, RAM...).', output: 'Loại CI đã tồn tại hoặc được tạo mới' },
        { step: 'Tạo CI record', role: 'Kỹ thuật', detail: 'CMDB → + Thêm CI. Điền: tên CI, chọn loại, môi trường, trạng thái, mô tả, tài sản vật lý liên kết (nếu có). Điền thuộc tính theo schema.', output: 'CI record trong CMDB' },
        { step: 'Liên kết quan hệ', role: 'Kỹ thuật', detail: 'Trong chi tiết CI → Tab Quan hệ → + Thêm. Định nghĩa quan hệ: "runs_on" (VM → Host), "depends_on" (App → DB), "connects_to" (Server → Switch).', output: 'Dependency map trong CMDB' },
        { step: 'Liên kết dịch vụ', role: 'IT Manager', detail: 'Nếu CI là thành phần của một dịch vụ nghiệp vụ: CMDB → Dịch vụ → liên kết CI. Điền tên dịch vụ, business owner, SLA.', output: 'CI được gán vào service map' },
        { step: 'Thu thập file cấu hình', role: 'Kỹ thuật', detail: 'Trong chi tiết CI → Tab File cấu hình → + Thêm. Upload hoặc paste file: nginx.conf, postgresql.conf, network policy... Ghi rõ phiên bản, ngày hiệu lực.', output: 'Config files baseline trong CMDB' },
        { step: 'Xem xét & Xác nhận', role: 'IT Manager', detail: 'Review toàn bộ CI record: thuộc tính đầy đủ, quan hệ chính xác, config files hiện hành. Cập nhật trạng thái CI → "active".', output: 'CI trạng thái "active", sẵn sàng sử dụng' }
      ],
      kpi: ['Tỷ lệ CI có đầy đủ thuộc tính ≥ 90%', 'Tỷ lệ CI có ít nhất 1 quan hệ được map ≥ 80%', 'Config files baseline được capture trong 5 ngày sau triển khai'],
      exceptions: ['CI không thuộc loại nào có sẵn → tạo loại mới, báo cáo IT Manager để chuẩn hóa.', 'CI bị trùng lặp → merge hoặc đánh dấu deprecated.', 'Không có file cấu hình → ghi chú lý do và ngày dự kiến capture.']
    },
    {
      key: 'cmdb-change-management',
      title: 'QT-09: Quản lý thay đổi CI (Change Management)',
      description: 'Quy trình kiểm soát thay đổi cấu hình CI: phê duyệt trước khi thực hiện, ghi nhận sau khi hoàn thành, đánh giá tác động.',
      scope: 'Áp dụng cho mọi thay đổi cấu hình ảnh hưởng đến CI trong CMDB, đặc biệt môi trường production.',
      triggers: ['Nâng cấp firmware/OS', 'Thay đổi cấu hình mạng/tường lửa', 'Thêm/xóa thành phần phần cứng', 'Cập nhật file cấu hình ứng dụng', 'Migration, re-IP, load balancer config'],
      steps: [
        { step: 'Lập phiếu yêu cầu thay đổi', role: 'Kỹ thuật', detail: 'Mô tả thay đổi: what/why/when/risk. Xác định CI bị tác động. Lập kế hoạch rollback. Đề xuất maintenance window.', output: 'Change Request (RFC)' },
        { step: 'Đánh giá tác động', role: 'IT Manager', detail: 'CMDB → CI liên quan → Tab Quan hệ → xem dependency map. Xác định các CI, dịch vụ bị ảnh hưởng. Đánh giá rủi ro.', output: 'Impact Assessment Report' },
        { step: 'Phê duyệt', role: 'Quản lý', detail: 'Review RFC + Impact Assessment. Phê duyệt hoặc yêu cầu bổ sung. Confirm maintenance window.', output: 'RFC được phê duyệt, ngày thực hiện xác nhận' },
        { step: 'Backup cấu hình hiện tại', role: 'Kỹ thuật', detail: 'CMDB → CI → Tab File cấu hình → lưu phiên bản hiện tại trước khi thay đổi (hệ thống auto-version khi cập nhật). Hoặc export thủ công.', output: 'Config version snapshot trước thay đổi' },
        { step: 'Thực hiện thay đổi', role: 'Kỹ thuật', detail: 'Thực hiện trong maintenance window. Theo dõi sát trong quá trình. Sẵn sàng rollback nếu có vấn đề.', output: 'Thay đổi được áp dụng' },
        { step: 'Cập nhật CMDB', role: 'Kỹ thuật', detail: 'CMDB → CI → cập nhật thuộc tính mới. Upload file cấu hình mới → tự tạo version mới. Cập nhật quan hệ nếu có thay đổi.', output: 'CMDB phản ánh đúng trạng thái mới' },
        { step: 'Kiểm tra & Đóng RFC', role: 'IT Manager', detail: 'Verify hệ thống hoạt động bình thường sau thay đổi. Ghi nhận kết quả vào RFC. Đóng Change Request.', output: 'RFC đóng, CMDB audit trail đầy đủ' }
      ],
      kpi: ['100% thay đổi production phải có RFC được phê duyệt', 'Tỷ lệ thay đổi thành công (không cần rollback) ≥ 95%', 'CMDB được cập nhật trong 24h sau thay đổi', 'Thời gian xử lý RFC ≤ 2 ngày làm việc (standard change)'],
      exceptions: ['Emergency change (sự cố production): thực hiện trước, làm RFC sau trong 24h.', 'Rollback cần thiết: hoàn tác thay đổi, restore config version cũ từ CMDB, mở RFC mới.', 'CMDB không khớp thực tế: tạo task kiểm tra và reconcile.']
    },
    {
      key: 'cmdb-config-file-management',
      title: 'QT-10: Quản lý file cấu hình CI',
      description: 'Quy trình duy trì, phiên bản hóa và khôi phục file cấu hình cho các CI trong CMDB.',
      scope: 'Áp dụng cho tất cả file cấu hình quan trọng: web server, database, network device, application config, scripts triển khai.',
      triggers: ['Triển khai CI mới (capture baseline)', 'Thay đổi cấu hình sau RFC', 'Sự cố cần rollback về config cũ', 'Review định kỳ (hàng quý)', 'Audit/compliance yêu cầu'],
      steps: [
        { step: 'Xác định files cần quản lý', role: 'Kỹ thuật', detail: 'Liệt kê các file cấu hình quan trọng của CI: ví dụ nginx.conf, postgresql.conf, firewall policy, deployment scripts. Ưu tiên files ảnh hưởng đến tính sẵn sàng hoặc bảo mật.', output: 'Danh sách files cần capture' },
        { step: 'Capture baseline', role: 'Kỹ thuật', detail: 'CMDB → CI → Tab "File cấu hình" → + Thêm file cấu hình. Đặt tên rõ ràng (VD: nginx.conf), chọn loại (config/script/template/env), ngôn ngữ syntax. Paste nội dung hoặc Import từ file.', output: 'Version 1 (baseline) được lưu' },
        { step: 'Cập nhật phiên bản', role: 'Kỹ thuật', detail: 'Sau mỗi thay đổi cấu hình: vào file → Sửa → cập nhật nội dung mới → Lưu. Hệ thống tự tạo version mới, giữ lại toàn bộ lịch sử. Ghi chú mô tả thay đổi trong trường "Ghi chú".', output: 'Version mới được tạo tự động' },
        { step: 'So sánh phiên bản', role: 'Kỹ thuật', detail: 'CI → File cấu hình → Tab "Lịch sử phiên bản" → chọn 2 version → So sánh. Xem diff màu: xanh lá = thêm, đỏ = xóa, vàng = sửa.', output: 'Báo cáo diff giữa 2 phiên bản' },
        { step: 'Rollback khi sự cố', role: 'Kỹ thuật', detail: 'Vào lịch sử phiên bản → chọn version ổn định cần khôi phục → Copy nội dung → Áp dụng thủ công lên server → Cập nhật lại CMDB với nội dung đã rollback.', output: 'Cấu hình server khớp với version CMDB' },
        { step: 'Review định kỳ', role: 'IT Manager', detail: 'Hàng quý: review toàn bộ config files trong CMDB. Kiểm tra: version trên server có khớp CMDB không? Files lỗi thời? Files thiếu? Lên kế hoạch cập nhật.', output: 'Config audit report' }
      ],
      kpi: ['100% CI production có ít nhất 1 config file baseline', 'Config files được cập nhật trong 24h sau mỗi thay đổi', 'Tỷ lệ CI có config khớp giữa CMDB và thực tế ≥ 95% (qua quarterly audit)', 'Thời gian rollback từ CMDB ≤ 30 phút'],
      exceptions: ['File quá lớn (>1MB): lưu trữ external, chỉ lưu metadata + link trong CMDB.', 'File chứa secret (password, API key): không được lưu nội dung thực, thay bằng placeholder.', 'Server config khác CMDB: điều tra nguyên nhân → cập nhật CMDB hoặc revert server.']
    }
  ];

  let expandedProcess = $state<string | null>(null);
</script>

<section id="business-process" class="scroll-mt-20">
  <div class="flex items-center gap-2 mb-3">
    <FileText class="h-5 w-5 text-emerald-400" />
    <h2 class="text-xl font-bold text-slate-50">Bộ Quy trình nghiệp vụ</h2>
    <button onclick={() => copyAnchor('business-process')} class="ml-auto text-slate-500 hover:text-primary transition-colors" title="Copy link">
      {#if copiedId === 'business-process'}
        <Check class="h-4 w-4 text-green-400" />
      {:else}
        <Link2 class="h-4 w-4" />
      {/if}
    </button>
  </div>

  <div class="bg-surface-2 rounded-lg border border-slate-700/40 p-5 space-y-4">
    <p class="text-sm text-slate-300">
      Bộ quy trình nghiệp vụ chuẩn (SOP) gồm 10 quy trình bao phủ toàn bộ vòng đời tài sản IT và quản lý cấu hình CMDB. Mỗi quy trình có đầy đủ: phạm vi, điều kiện kích hoạt, các bước thực hiện, KPI đo lường và xử lý ngoại lệ.
    </p>

    <div class="grid sm:grid-cols-2 gap-3">
      <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3 text-xs text-emerald-300">
        <p class="font-semibold mb-1">Vòng đời tài sản IT</p>
        <p>QT-07 (Mua sắm) → QT-01 (Tiếp nhận) → QT-02 (Phân bổ) → QT-03 (Thu hồi) → QT-04 (Sửa chữa) → QT-05 (Thanh lý)</p>
        <p class="mt-1 text-emerald-400/70">· QT-06 (Kiểm kê) chạy song song định kỳ</p>
      </div>
      <div class="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-xs text-blue-300">
        <p class="font-semibold mb-1">Quản lý cấu hình (CMDB)</p>
        <p>QT-08 (Đăng ký CI) → QT-09 (Thay đổi) → QT-10 (File cấu hình)</p>
        <p class="mt-1 text-blue-400/70">· QT-09 kích hoạt mỗi khi có RFC · QT-10 chạy song song & định kỳ</p>
      </div>
    </div>

    <div class="space-y-3">
      {#each processes as proc (proc.key)}
        <div class="bg-slate-800/30 rounded-lg border border-white/5 overflow-hidden">
          <button
            class="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/50 transition-colors"
            onclick={() => expandedProcess = expandedProcess === proc.key ? null : proc.key}
          >
            <ChevronRight class="w-4 h-4 text-slate-400 shrink-0 transition-transform {expandedProcess === proc.key ? 'rotate-90' : ''}" />
            <div class="min-w-0 flex-1">
              <span class="font-semibold text-sm text-slate-100">{proc.title}</span>
              <p class="text-xs text-slate-500 mt-0.5 truncate">{proc.description}</p>
            </div>
          </button>

          {#if expandedProcess === proc.key}
            <div class="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
              <!-- Scope & Triggers -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <h4 class="font-semibold text-slate-300 mb-1">📋 Phạm vi</h4>
                  <p class="text-slate-400">{proc.scope}</p>
                </div>
                <div>
                  <h4 class="font-semibold text-slate-300 mb-1">⚡ Điều kiện kích hoạt</h4>
                  <ul class="list-disc list-inside text-slate-400 space-y-0.5">
                    {#each proc.triggers as trigger}
                      <li>{trigger}</li>
                    {/each}
                  </ul>
                </div>
              </div>

              <!-- Steps -->
              <div>
                <h4 class="text-xs font-semibold text-slate-300 mb-3">📌 Các bước thực hiện</h4>
                <div class="space-y-2">
                  {#each proc.steps as s, i}
                    <div class="flex gap-3 text-xs">
                      <div class="flex flex-col items-center">
                        <div class="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                          {i + 1}
                        </div>
                        {#if i < proc.steps.length - 1}
                          <div class="w-px flex-1 bg-slate-700 my-1"></div>
                        {/if}
                      </div>
                      <div class="flex-1 pb-2">
                        <div class="flex items-center gap-2 mb-0.5">
                          <span class="font-semibold text-slate-100">{s.step}</span>
                          <span class="badge-primary text-[10px]">{s.role}</span>
                        </div>
                        <p class="text-slate-400">{s.detail}</p>
                        <p class="text-slate-500 mt-0.5">📤 <em>{s.output}</em></p>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <!-- KPI -->
              {#if proc.kpi?.length}
                <div>
                  <h4 class="text-xs font-semibold text-green-400 mb-1">📊 KPI đo lường</h4>
                  <ul class="list-disc list-inside text-xs text-slate-400 space-y-0.5">
                    {#each proc.kpi as kpi}
                      <li>{kpi}</li>
                    {/each}
                  </ul>
                </div>
              {/if}

              <!-- Exceptions -->
              {#if proc.exceptions?.length}
                <div>
                  <h4 class="text-xs font-semibold text-amber-400 mb-1">⚠️ Xử lý ngoại lệ</h4>
                  <ul class="list-disc list-inside text-xs text-slate-400 space-y-0.5">
                    {#each proc.exceptions as ex}
                      <li>{ex}</li>
                    {/each}
                  </ul>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</section>
