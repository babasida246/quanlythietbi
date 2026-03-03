import fs from 'fs';

const enP = 'apps/web-ui/src/lib/i18n/locales/en.json';
const viP = 'apps/web-ui/src/lib/i18n/locales/vi.json';

// Fix: strip any trailing literal \n characters, then parse
function readJson(p) {
    let raw = fs.readFileSync(p, 'utf8');
    // Remove trailing literal backslash-n sequences
    while (raw.endsWith('\\n')) raw = raw.slice(0, -2);
    raw = raw.trim();
    return JSON.parse(raw);
}

const en = readJson(enP);
const vi = readJson(viP);

function set(obj, path, val) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        // If the intermediate key exists but is a string (not an object), convert it
        if (typeof cur[parts[i]] === 'string') cur[parts[i]] = {};
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (!cur[parts[parts.length - 1]]) cur[parts[parts.length - 1]] = val;
}

const keys = {
    // === setup.firstTime ===
    'setup.firstTime.pageTitle': ['First Time Setup - NetOpsAI Gateway', 'Thiết lập lần đầu - NetOpsAI Gateway'],
    'setup.firstTime.brand': ['NetOpsAI Gateway', 'NetOpsAI Gateway'],
    'setup.firstTime.title': ['First Time Setup', 'Thiết lập lần đầu'],
    'setup.firstTime.checking': ['Checking system status...', 'Đang kiểm tra trạng thái hệ thống...'],
    'setup.firstTime.pleaseWait': ['Please wait a moment', 'Vui lòng chờ trong giây lát'],
    'setup.firstTime.connectionError': ['Connection error', 'Lỗi kết nối'],
    'setup.firstTime.retry': ['Retry', 'Thử lại'],
    'setup.firstTime.version': ['Version:', 'Phiên bản:'],
    'setup.firstTime.environment': ['Environment:', 'Môi trường:'],
    'setup.firstTime.database': ['Database:', 'Database:'],
    'setup.firstTime.refreshStatus': ['Refresh status', 'Làm mới trạng thái'],
    'setup.firstTime.stepLabel': ['Step {step}: {title}', 'Bước {step}: {title}'],
    'setup.firstTime.back': ['Back', 'Quay lại'],
    'setup.firstTime.stepProgress': ['Step {current} / {total}', 'Bước {current} / {total}'],
    'setup.firstTime.copyright': ['© 2026 TechCorp Vietnam. All rights reserved.', '© 2026 TechCorp Vietnam. All rights reserved.'],
    'setup.firstTime.loadError': ['Failed to load setup status', 'Không thể tải trạng thái thiết lập'],

    // === setup.steps ===
    'setup.steps.database': ['Database', 'Cơ sở dữ liệu'],
    'setup.steps.databaseDesc': ['Check and initialize database', 'Kiểm tra và khởi tạo database'],
    'setup.steps.admin': ['Admin Account', 'Tài khoản Admin'],
    'setup.steps.adminDesc': ['Create first admin account', 'Tạo tài khoản quản trị viên đầu tiên'],
    'setup.steps.systemConfig': ['System Configuration', 'Cấu hình hệ thống'],
    'setup.steps.systemConfigDesc': ['Set up company and system info', 'Thiết lập thông tin công ty và hệ thống'],
    'setup.steps.aiProviders': ['AI Providers', 'AI Providers'],
    'setup.steps.aiProvidersDesc': ['Configure AI providers', 'Cấu hình các nhà cung cấp AI'],
    'setup.steps.seedData': ['Sample Data', 'Dữ liệu mẫu'],
    'setup.steps.seedDataDesc': ['Load initial sample data', 'Tải dữ liệu mẫu ban đầu'],
    'setup.steps.completion': ['Completion', 'Hoàn thành'],
    'setup.steps.completionDesc': ['Finish setup process', 'Kết thúc quá trình thiết lập'],

    // === setup.stepIndicator ===
    'setup.stepIndicator.progress': ['Setup progress', 'Tiến trình thiết lập'],
    'setup.stepIndicator.completed': ['Completed', 'Hoàn thành'],
    'setup.stepIndicator.error': ['Error', 'Lỗi'],
    'setup.stepIndicator.inProgress': ['In progress', 'Đang thực hiện'],
    'setup.stepIndicator.waiting': ['Waiting', 'Chờ'],
    'setup.stepIndicator.overallProgress': ['Overall progress', 'Tiến độ tổng thể'],

    // === setup.seed ===
    'setup.seed.title': ['Load Sample Data', 'Tải dữ liệu mẫu'],
    'setup.seed.subtitle': ['Load demo data to fully experience system features', 'Tải dữ liệu demo để trải nghiệm đầy đủ các tính năng hệ thống'],
    'setup.seed.demoIncludes': ['Demo data includes:', 'Dữ liệu demo bao gồm:'],
    'setup.seed.demoRealistic': ['Realistic TechCorp Vietnam data for testing and demo', 'Dữ liệu thực tế của TechCorp Vietnam để test và demo'],
    'setup.seed.benefits': ['Benefits of sample data:', 'Lợi ích của việc sử dụng dữ liệu mẫu:'],
    'setup.seed.quickStart': ['Quick start:', 'Khởi động nhanh:'],
    'setup.seed.quickStartDesc': ['Experience features immediately without manual setup', 'Trải nghiệm ngay các tính năng mà không cần setup thủ công'],
    'setup.seed.understandWorkflow': ['Understand workflow:', 'Hiểu workflow:'],
    'setup.seed.understandWorkflowDesc': ['See how the system works with real data', 'Xem cách hệ thống hoạt động với dữ liệu thực tế'],
    'setup.seed.fullTest': ['Full testing:', 'Test đầy đủ:'],
    'setup.seed.fullTestDesc': ['Test reports, analytics and all modules', 'Kiểm tra reports, analytics và tất cả module'],
    'setup.seed.learnUsage': ['Learn usage:', 'Học cách sử dụng:'],
    'setup.seed.learnUsageDesc': ['Ready-made data for practice', 'Có sẵn dữ liệu để thực hành'],
    'setup.seed.note': ['Note:', 'Lưu ý:'],
    'setup.seed.noteText': ['Sample data will be added to the current database. You can delete or edit it later in the admin panel. This data is completely safe and does not affect the system.', 'Dữ liệu mẫu sẽ được thêm vào database hiện tại. Bạn có thể xóa hoặc chỉnh sửa sau này trong admin panel. Dữ liệu này hoàn toàn an toàn và không ảnh hưởng đến hệ thống.'],
    'setup.seed.loadBtn': ['Load Sample Data', 'Tải dữ liệu mẫu'],
    'setup.seed.skip': ['Skip', 'Bỏ qua'],
    'setup.seed.loading': ['Loading sample data...', 'Đang tải dữ liệu mẫu...'],
    'setup.seed.back': ['← Back', '← Quay lại'],
    'setup.seed.continue': ['Continue →', 'Tiếp tục ➡️'],
    'setup.seed.preparing': ['Preparing...', 'Preparing...'],
    'setup.seed.loadFailed': ['Failed to load seed data', 'Không thể tải dữ liệu mẫu'],
    'setup.seed.skipFailed': ['Failed to skip seed data', 'Bỏ qua dữ liệu mẫu thất bại'],
    'setup.seed.markCompleteFailed': ['Failed to mark seed step as complete', 'Đánh dấu hoàn thành thất bại'],
    'setup.seed.progressUsers': ['Creating users and roles...', 'Đang tạo users và roles...'],
    'setup.seed.progressLocations': ['Setting up locations structure...', 'Đang thiết lập cấu trúc vị trí...'],
    'setup.seed.progressAssets': ['Adding assets and equipment...', 'Đang thêm tài sản và thiết bị...'],
    'setup.seed.progressCmdb': ['Configuring CMDB items...', 'Đang cấu hình CMDB...'],
    'setup.seed.progressSpares': ['Loading spare parts inventory...', 'Đang tải linh kiện dự phòng...'],
    'setup.seed.progressFinalizing': ['Finalizing setup...', 'Đang hoàn tất...'],
    'setup.seed.usersRoles': ['Users & Roles', 'Users & Roles'],
    'setup.seed.usersRolesDesc': ['10 users with different roles', '10 người dùng với các vai trò khác nhau'],
    'setup.seed.usersRolesCount': ['10 users', '10 users'],
    'setup.seed.locations': ['Locations', 'Locations'],
    'setup.seed.locationsDesc': ['Location structure: Building → Floor → Room → Rack', 'Cấu trúc vị trí: Tòa nhà → Tầng → Phòng → Rack'],
    'setup.seed.locationsCount': ['20 locations', '20 locations'],
    'setup.seed.assets': ['Assets', 'Assets'],
    'setup.seed.assetsDesc': ['Network devices, servers with realistic configs', 'Thiết bị mạng, máy chủ với cấu hình thực tế'],
    'setup.seed.assetsCount': ['25 assets', '25 assets'],
    'setup.seed.cmdb': ['CMDB', 'CMDB'],
    'setup.seed.cmdbDesc': ['Configuration Items and relationships', 'Configuration Items và mối quan hệ'],
    'setup.seed.cmdbCount': ['20 CIs', '20 CIs'],
    'setup.seed.spares': ['Spare Parts', 'Spare Parts'],
    'setup.seed.sparesDesc': ['Spare parts and inventory', 'Linh kiện dự phòng và inventory'],
    'setup.seed.sparesCount': ['16 parts', '16 parts'],
    'setup.seed.aiModels': ['AI Models', 'AI Models'],
    'setup.seed.aiModelsDesc': ['AI providers and models configuration', 'Cấu hình các AI providers và models'],
    'setup.seed.aiModelsCount': ['4 providers', '4 providers'],

    // === setup.completion ===
    'setup.completion.finalizing': ['Finalizing setup...', 'Hoàn tất cài đặt...'],
    'setup.completion.savingConfig': ['Saving configuration and initializing system', 'Đang lưu cấu hình và khởi tạo hệ thống'],
    'setup.completion.errorOccurred': ['An error occurred', 'Có lỗi xảy ra'],
    'setup.completion.retry': ['Retry', 'Thử lại'],
    'setup.completion.goLogin': ['Go to login page', 'Về trang đăng nhập'],
    'setup.completion.congratulations': ['Congratulations! System is ready', 'Chúc mừng! Hệ thống đã sẵn sàng'],
    'setup.completion.successMsg': ['TechCorp Vietnam Gateway has been installed and configured successfully', 'TechCorp Vietnam Gateway đã được cài đặt và cấu hình thành công'],
    'setup.completion.summary': ['Setup Summary', 'Tóm tắt cài đặt'],
    'setup.completion.percentComplete': ['{percent}% complete', '{percent}% hoàn thành'],
    'setup.completion.dbInitialized': ['Database initialized', 'Database đã khởi tạo'],
    'setup.completion.adminCreated': ['Admin user created', 'Admin user đã tạo'],
    'setup.completion.systemConfigured': ['System configured', 'Hệ thống đã cấu hình'],
    'setup.completion.aiSetup': ['AI providers set up', 'AI providers đã thiết lập'],
    'setup.completion.seedLoaded': ['Sample data loaded', 'Dữ liệu mẫu đã tải'],
    'setup.completion.loginInfo': ['Login Information', 'Thông tin đăng nhập'],
    'setup.completion.email': ['Email:', 'Email:'],
    'setup.completion.password': ['Password:', 'Password:'],
    'setup.completion.changePasswordHint': ['Please change your password after first login for security', 'Hãy đổi mật khẩu sau khi đăng nhập lần đầu để bảo mật'],
    'setup.completion.goDashboard': ['Go to Dashboard', 'Vào Dashboard'],
    'setup.completion.goLoginPage': ['Go to login page', 'Đến trang đăng nhập'],
    'setup.completion.downloadReport': ['Download setup report', 'Tải báo cáo setup'],
    'setup.completion.nextSteps': ['Next Steps', 'Các bước tiếp theo'],
    'setup.completion.step1Title': ['Login to system:', 'Đăng nhập hệ thống:'],
    'setup.completion.step1Desc': ['Use the admin info above to login', 'Sử dụng thông tin admin ở trên để đăng nhập'],
    'setup.completion.step2Title': ['Change password:', 'Đổi mật khẩu:'],
    'setup.completion.step2Desc': ['Go to Settings → Profile to change default password', 'Vào Settings → Profile để đổi mật khẩu mặc định'],
    'setup.completion.step3Title': ['Explore sample data:', 'Khám phá dữ liệu mẫu:'],
    'setup.completion.step3DescA': ['Review Assets, Locations, Users to understand how the system works', 'Xem qua Assets, Locations, Users để hiểu cách hệ thống hoạt động'],
    'setup.completion.step3DescB': ['Add your company real data', 'Thêm dữ liệu thực tế của công ty bạn'],
    'setup.completion.step4Title': ['Additional configuration:', 'Cấu hình bổ sung:'],
    'setup.completion.step4Desc': ['Check Settings to adjust parameters as needed', 'Kiểm tra Settings để điều chỉnh các tham số theo nhu cầu'],
    'setup.completion.step5Title': ['Create user accounts:', 'Tạo user account:'],
    'setup.completion.step5Desc': ['Add other members to the system', 'Thêm các thành viên khác vào hệ thống'],
    'setup.completion.failedComplete': ['Failed to complete setup', 'Hoàn tất setup thất bại'],

    // === setup.systemConfig ===
    'setup.systemConfig.title': ['System Configuration', 'Cấu hình hệ thống'],
    'setup.systemConfig.subtitle': ['Set up company info and SMTP configuration (optional)', 'Thiết lập thông tin công ty và cấu hình SMTP (tùy chọn)'],
    'setup.systemConfig.companyInfo': ['Company Information', 'Thông tin công ty'],
    'setup.systemConfig.companyName': ['Company name *', 'Tên công ty *'],
    'setup.systemConfig.address': ['Address', 'Địa chỉ'],
    'setup.systemConfig.phone': ['Phone', 'Số điện thoại'],
    'setup.systemConfig.email': ['Email', 'Email'],
    'setup.systemConfig.regionalSettings': ['Regional Settings', 'Cài đặt vùng miền'],
    'setup.systemConfig.timezone': ['Timezone', 'Múi giờ'],
    'setup.systemConfig.language': ['Language', 'Ngôn ngữ'],
    'setup.systemConfig.currency': ['Currency', 'Đơn vị tiền tệ'],
    'setup.systemConfig.smtpConfig': ['Email SMTP Configuration (Optional)', 'Cấu hình Email SMTP (Tùy chọn)'],
    'setup.systemConfig.smtpSubtitle': ['Configure email server for notifications and password reset', 'Cấu hình máy chủ email để gửi thông báo và reset mật khẩu'],
    'setup.systemConfig.useTls': ['Use secure connection (TLS/SSL)', 'Sử dụng kết nối an toàn (TLS/SSL)'],
    'setup.systemConfig.back': ['← Back', '← Quay lại'],
    'setup.systemConfig.saving': ['Saving...', 'Đang lưu...'],
    'setup.systemConfig.continue': ['Continue →', 'Tiếp tục ➡️'],
    'setup.systemConfig.companyRequired': ['Company name is required', 'Tên công ty là bắt buộc'],
    'setup.systemConfig.invalidEmail': ['Please enter a valid email address', 'Vui lòng nhập email hợp lệ'],
    'setup.systemConfig.saveFailed': ['Failed to save system configuration', 'Lưu cấu hình hệ thống thất bại'],
    'setup.systemConfig.unknownError': ['Unknown error occurred', 'Đã xảy ra lỗi không xác định'],
    'setup.systemConfig.vietnamese': ['Tiếng Việt', 'Tiếng Việt'],
    'setup.systemConfig.english': ['English', 'English'],

    // === setup.aiProviders ===
    'setup.aiProviders.title': ['Configure AI Providers', 'Cấu hình AI Providers'],
    'setup.aiProviders.subtitle': ['Set up AI providers for chatbot and assistant (optional)', 'Thiết lập các nhà cung cấp AI để sử dụng chatbot và assistant (tùy chọn)'],
    'setup.aiProviders.openaiDesc': ['GPT-4, ChatGPT and advanced AI models', 'GPT-4, ChatGPT và các model AI tiên tiến'],
    'setup.aiProviders.anthropicDesc': ['Claude - intelligent and safe AI assistant', 'Claude - AI assistant thông minh và an toàn'],
    'setup.aiProviders.googleDesc': ['Gemini - Google multimodal AI model', 'Gemini - AI model đa phương thức của Google'],
    'setup.aiProviders.azureDesc': ['OpenAI models via Microsoft Azure', 'OpenAI models thông qua Microsoft Azure'],
    'setup.aiProviders.connectionSuccess': ['Connection successful', 'Kết nối thành công'],
    'setup.aiProviders.connectionFailed': ['Connection failed', 'Kết nối thất bại'],
    'setup.aiProviders.saveFailed': ['Failed to save AI providers configuration', 'Lưu cấu hình AI providers thất bại'],
    'setup.aiProviders.unknownError': ['Unknown error', 'Lỗi không xác định'],
    'setup.aiProviders.enterModelName': ['Enter model name:', 'Nhập tên model:'],
    'setup.aiProviders.organization': ['Organization (optional)', 'Organization (tùy chọn)'],
    'setup.aiProviders.removeModel': ['Remove model', 'Xóa model'],
    'setup.aiProviders.addModel': ['+ Add model', '+ Thêm model'],
    'setup.aiProviders.note': ['Note:', 'Lưu ý:'],
    'setup.aiProviders.noteText': ['You can skip this step and configure AI providers later in system settings. Chatbot and AI assistant features will only be available after configuring at least one provider.', 'Bạn có thể bỏ qua bước này và cấu hình AI providers sau trong phần cài đặt hệ thống. Các tính năng chatbot và AI assistant sẽ chỉ khả dụng sau khi cấu hình ít nhất một provider.'],
    'setup.aiProviders.back': ['← Back', '← Quay lại'],
    'setup.aiProviders.saving': ['Saving...', 'Đang lưu...'],
    'setup.aiProviders.continue': ['Continue →', 'Tiếp tục ➡️'],

    // === setup.database ===
    'setup.database.successTitle': ['Database initialized successfully', 'Database đã được khởi tạo thành công'],
    'setup.database.successDesc': ['Database connection is working and tables have been created.', 'Kết nối database hoạt động bình thường và các bảng đã được tạo.'],
    'setup.database.continue': ['Continue →', 'Tiếp tục →'],
    'setup.database.errorTitle': ['Database connection error', 'Lỗi kết nối database'],
    'setup.database.errorFallback': ['Cannot connect to database', 'Không thể kết nối với database'],
    'setup.database.checking': ['Checking...', 'Đang kiểm tra...'],
    'setup.database.retry': ['Retry', 'Thử lại'],
    'setup.database.checkingDb': ['Checking database...', 'Đang kiểm tra database...'],
    'setup.database.checkingDesc': ['Checking connection and initializing database schema.', 'Kiểm tra kết nối và khởi tạo schema database.'],
    'setup.database.setupTitle': ['Database Setup', 'Thiết lập cơ sở dữ liệu'],
    'setup.database.setupDesc': ['This step will check database connection and initialize required tables.', 'Bước này sẽ kiểm tra kết nối database và khởi tạo các bảng cần thiết cho hệ thống.'],
    'setup.database.info': ['Database Information', 'Thông tin Database'],
    'setup.database.type': ['Type:', 'Loại:'],
    'setup.database.status': ['Status:', 'Trạng thái:'],
    'setup.database.connected': ['Connected', 'Đã kết nối'],
    'setup.database.notConnected': ['Not connected', 'Chưa kết nối'],
    'setup.database.autoCheck': ['Database will be checked and initialized automatically.', 'Database sẽ được kiểm tra và khởi tạo tự động.'],
    'setup.database.startCheck': ['Start check', 'Bắt đầu kiểm tra'],
    'setup.database.initResult': ['Initialization result:', 'Kết quả khởi tạo:'],
    'setup.database.connectionSuccess': ['Database connection successful', 'Kết nối database thành công'],
    'setup.database.tableCount': ['Table count:', 'Số bảng:'],
    'setup.database.migrationsRun': ['Migrations run:', 'Migrations đã chạy:'],
    'setup.database.setupFailed': ['Database setup failed', 'Thiết lập database thất bại'],

    // === setup.adminSetup ===
    'setup.adminSetup.accountCreated': ['Admin account created', 'Tài khoản Admin đã được tạo'],
    'setup.adminSetup.accountExists': ['An admin account already exists in the system.', 'Tài khoản quản trị viên đã tồn tại trong hệ thống.'],
    'setup.adminSetup.back': ['← Back', '← Quay lại'],
    'setup.adminSetup.continue': ['Continue →', 'Tiếp tục →'],
    'setup.adminSetup.createdSuccess': ['Admin account created successfully!', 'Tài khoản Admin đã được tạo thành công!'],
    'setup.adminSetup.accountInfo': ['Account information:', 'Thông tin tài khoản:'],
    'setup.adminSetup.email': ['Email:', 'Email:'],
    'setup.adminSetup.name': ['Name:', 'Tên:'],
    'setup.adminSetup.role': ['Role:', 'Vai trò:'],
    'setup.adminSetup.id': ['ID:', 'ID:'],
    'setup.adminSetup.createTitle': ['Create admin account', 'Tạo tài khoản quản trị viên'],
    'setup.adminSetup.createDesc': ['Create first admin account to manage the system.', 'Tạo tài khoản admin đầu tiên để quản lý hệ thống.'],
    'setup.adminSetup.fullName': ['Full name *', 'Tên đầy đủ *'],
    'setup.adminSetup.password': ['Password *', 'Mật khẩu *'],
    'setup.adminSetup.confirmPassword': ['Confirm password *', 'Xác nhận mật khẩu *'],
    'setup.adminSetup.passwordRequirements': ['Password requirements:', 'Yêu cầu mật khẩu:'],
    'setup.adminSetup.pwMin8': ['At least 8 characters', 'Ít nhất 8 ký tự'],
    'setup.adminSetup.pwUppercase': ['At least 1 uppercase letter (A-Z)', 'Chứa ít nhất 1 chữ hoa (A-Z)'],
    'setup.adminSetup.pwLowercase': ['At least 1 lowercase letter (a-z)', 'Chứa ít nhất 1 chữ thường (a-z)'],
    'setup.adminSetup.pwDigit': ['At least 1 digit (0-9)', 'Chứa ít nhất 1 số (0-9)'],
    'setup.adminSetup.pwSpecial': ['Should contain special characters (!@#$%...)', 'Nên chứa ký tự đặc biệt (!@#$%...)'],
    'setup.adminSetup.creating': ['Creating...', 'Đang tạo...'],
    'setup.adminSetup.createAccount': ['Create account', 'Tạo tài khoản'],
    'setup.adminSetup.setupFailed': ['Admin setup failed', 'Thiết lập admin thất bại'],
    'setup.adminSetup.emailRequired': ['Email is required', 'Email là bắt buộc'],
    'setup.adminSetup.emailInvalid': ['Invalid email', 'Email không hợp lệ'],
    'setup.adminSetup.nameMin2': ['Name must be at least 2 characters', 'Tên phải có ít nhất 2 ký tự'],
    'setup.adminSetup.usernameMin3': ['Username must be at least 3 characters', 'Username phải có ít nhất 3 ký tự'],
    'setup.adminSetup.usernameChars': ['Username can only contain letters, digits, dots, underscores, and hyphens', 'Username chỉ được chứa chữ cái, số, dấu chấm, gạch dưới và gạch ngang'],
    'setup.adminSetup.passwordMin8': ['Password must be at least 8 characters', 'Mật khẩu phải có ít nhất 8 ký tự'],
    'setup.adminSetup.passwordComplexity': ['Password must contain at least 1 lowercase, 1 uppercase, and 1 digit', 'Mật khẩu phải chứa ít nhất 1 chữ thường, 1 chữ hoa và 1 số'],
    'setup.adminSetup.passwordMismatch': ['Passwords do not match', 'Mật khẩu xác nhận không khớp'],
};

let count = 0;
for (const [path, [enV, viV]] of Object.entries(keys)) {
    set(en, path, enV);
    set(vi, path, viV);
    count++;
}

fs.writeFileSync(enP, JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(viP, JSON.stringify(vi, null, 2) + '\n');
console.log(`✅ Added ${count} setup i18n keys`);
