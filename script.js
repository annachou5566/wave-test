    
    
    
    /* ================= SETUP ================= */
    const SUPABASE_URL = 'https://akbcpryqjigndzpuoany.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYmNwcnlxamlnbmR6cHVvYW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODg0NTEsImV4cCI6MjA4MDY2NDQ1MX0.p1lBHZ12fzyIrKiSL7DXv7VH74cq3QcU7TtBCJQBH9M';
    // --- DANH SÁCH ADMIN (Thêm bao nhiêu email tùy thích) ---
const ADMIN_EMAILS = [ 
    "annachou60@gmail.com", 
    "wavealphachannel@gmail.com",  
    ];
const PREDICT_FEE = 100;

// --- CẤU HÌNH TELEGRAM (BẢO MẬT - SECURE MODE) ---
const TELE_BOT_CONFIG = {
    // Tự động tìm Token trong bộ nhớ trình duyệt (không lộ trên code)
    get token() {
        return localStorage.getItem('WAVE_TELE_TOKEN'); 
    },
    // ID Group của bạn (Công khai được)
    chatId: '-1003355713341' // <--- THAY ID GROUP CỦA BẠN VÀO ĐÂY
};

// 1. Hàm hỗ trợ nhập Token (Chạy 1 lần là nhớ mãi trên máy này)
function requireBotToken() {
    let currentToken = TELE_BOT_CONFIG.token;
    if (!currentToken) {
        // Hiện bảng hỏi Token
        let input = prompt("⚠️ CHƯA CÓ TOKEN BOT!\n\nVui lòng dán Token BotFather vào đây (Chỉ cần làm 1 lần trên máy này):");
        if (input && input.trim() !== "") {
            localStorage.setItem('WAVE_TELE_TOKEN', input.trim());
            alert("✅ Đã lưu Token vào máy! Từ giờ bạn có thể cập nhật thoải mái.");
            return true;
        } else {
            alert("❌ Bạn chưa nhập Token nên không thể gửi tin nhắn Telegram.");
            return false;
        }
    }
    return true;
}

// --- HÀM GỬI ẢNH TELEGRAM (FINAL UPDATE: ĐỒNG BỘ LOGIC T+1 VỚI BOT) ---
async function sendTelePhoto(comp, newTarget) {
    
    // 1. Kiểm tra Token
    if (!requireBotToken()) return;
    const token = TELE_BOT_CONFIG.token;
    const chatId = TELE_BOT_CONFIG.chatId;

    // 2. Tìm thẻ bài
    const cardWrapper = document.querySelector(`.card-wrapper[data-id="${comp.db_id}"]`);
    if (!cardWrapper) {
        showToast("Error: Card element not found!", "error");
        return;
    }
    const cardElement = cardWrapper.querySelector('.tour-card');

    // --- HELPER: LÀM SẠCH SỐ (Chống lỗi NaN do dấu phẩy) ---
    const cleanNum = (val) => {
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '').trim()) || 0;
    };

    // 3. CHUẨN BỊ SỐ LIỆU (Tính toán trước khi chụp)
    // Ưu tiên lấy giá từ Market Analysis (mới nhất)
    let currentPrice = (comp.market_analysis && comp.market_analysis.price) ? comp.market_analysis.price : (comp.cachedPrice || 0);
    
    // Format Giá
    let priceStr = "---";
    if (currentPrice > 0) {
        priceStr = '$' + currentPrice.toLocaleString('en-US', { maximumFractionDigits: 4 });
    }

    // Format Reward
    let qty = cleanNum(comp.rewardQty);
    let rewardVal = qty * currentPrice;
    let rewardHtml = fmtNum(qty); 
    if (rewardVal > 0) {
        let valStr = '~$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rewardVal);
        rewardHtml += ` <span style="color:#0ECB81; font-size:0.8em; font-weight:bold;">${valStr}</span>`;
    }

    // 4. CAN THIỆP DOM (Tiêm dữ liệu vào thẻ để chụp)
    let statsGrid = cardElement.querySelector('.card-stats-grid');
    let oldRewardHTML = "", oldPriceHTML = "";
    let priceEl, rewardEl;

    if (statsGrid) {
        // Ô Reward
        rewardEl = statsGrid.children[1].querySelector('.stat-val');
        if (rewardEl) {
            oldRewardHTML = rewardEl.innerHTML;
            rewardEl.innerHTML = rewardHtml; 
        }
        // Ô Price
        priceEl = statsGrid.children[2].querySelector('.stat-val');
        if (priceEl) {
            oldPriceHTML = priceEl.innerHTML;
            priceEl.innerHTML = priceStr;    
            priceEl.style.color = "#00F0FF"; 
        }
    }

    // 5. BẬT CHẾ ĐỘ CHỤP
    cardElement.classList.add('snapshot-mode');
    showToast("📸 Snapping...", "info");

    try {
        // 6. CHỤP ẢNH
        const canvas = await html2canvas(cardElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#161a1e',
            logging: false,
            allowTaint: true,
            onclone: (clonedDoc) => {
                let clonedCard = clonedDoc.querySelector('.tour-card');
                if(clonedCard) {
                    clonedCard.style.transform = 'none';
                    clonedCard.style.boxShadow = 'none';
                }
            }
        });

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        // --- TÍNH TOÁN CAPTION & LOGIC CHANGE (QUAN TRỌNG) ---
        let rewardMsg = rewardVal > 0 ? `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rewardVal)}` : '---';
        
        let changeText = "";
        let currVal = cleanNum(newTarget); // Giá trị vừa nhập (đang là phần tử cuối)

        // Clone mảng history và sắp xếp lại theo ngày cho chắc chắn
        let history = comp.history ? [...comp.history] : [];
        history.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Logic: Vì hàm saveAdminTargetOnly đã push dữ liệu mới vào history rồi
        // Nên history.length - 1 chính là số vừa nhập (T)
        // history.length - 2 chính là số cũ (T-1)
        if (history.length >= 2) {
            let prevVal = cleanNum(history[history.length - 2].target);
            let diff = currVal - prevVal;
            
            if (diff !== 0) {
                let sign = diff > 0 ? '+' : '-';
                let icon = diff > 0 ? '📈' : '📉';
                let diffStr = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(diff));
                changeText = ` (${icon} ${sign}$${diffStr})`;
            }
        } else if (currVal > 0) {
            changeText = ` (🚀 New)`;
        }

        const caption = `
🌊 <b>OFFICIAL UPDATE: ${comp.name}</b>
━━━━━━━━━━━━━━━━━━
🎯 <b>New Min Target:</b> <code>${newTarget}</code>${changeText}
💰 <b>Total Reward:</b> ${rewardMsg}
💵 <b>Current Price:</b> ${priceStr}

👇 <b>Tap to Open Wave Alpha Mini App</b>
        `.trim();

        // 7. GỬI API
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', blob, 'update.png');
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        
        const replyMarkup = {
            inline_keyboard: [[{ text: "🚀 Open Wave Alpha Mini App", url: "https://t.me/WaveAlphaSignal_bot/miniapp" }]]
        };
        formData.append('reply_markup', JSON.stringify(replyMarkup));

        const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.ok) {
            console.log("✅ Photo sent!");
            showToast("✅ Image sent to Telegram!", "success");
        } else {
            throw new Error(result.description || "API Error");
        }

    } catch (e) {
        console.error("Tele Photo Error:", e);
        showToast("❌ Failed: " + e.message, "error");
    } finally {
        // 8. DỌN DẸP
        cardElement.classList.remove('snapshot-mode');
        if (rewardEl && oldRewardHTML) rewardEl.innerHTML = oldRewardHTML;
        if (priceEl && oldPriceHTML) {
            priceEl.innerHTML = oldPriceHTML;
            priceEl.style.color = "";
        }
    }
}


// --- [MỚI] BIẾN LƯU TRỮ LỊCH SỬ KHỚP LỆNH CHO TỪNG TOKEN ---
// Dùng để tính trung bình 10s cho nhiều token cùng lúc
let tokenVolHistory = {}; 
const SAFETY_WINDOW = 10; // Tính trung bình 10 mẫu gần nhất
/* --- BỘ TỪ ĐIỂN FULL (ĐÃ CẬP NHẬT TÊN & SLOGAN MỚI) --- */
let currentLang = localStorage.getItem('wave_lang') || 'en';



function formatCompact(num) {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
}

/* --- BỘ TỪ ĐIỂN ĐA NGÔN NGỮ (FINAL FIX: DISCLAIMER CHUẨN + LOGIC 30 PHÚT) --- */
const translations = {
    /* ==========================================================
       1. ENGLISH (EN)
       ========================================================== */
    en: {
        // ... Các key cũ giữ nguyên ...
        nav_sys_time: "SYSTEM TIME",
        nav_guide: "GUIDE",
        nav_login: "Login",
        nav_logout: "Logout",
        nav_wallet: "Wallets",
        nav_feedback: "Feedback",
        hero_title: "TOURNAMENT VOLUME TRACKER",
        hero_sub: "Manage your accounts & Join the prediction.",
        cmd_eco: "ECOSYSTEM",
        cmd_platform: "PLATFORMS",
        cmd_miniapp: "Mini App",
        cmd_channel: "Channel",
        cmd_bot: "Bot",
        cmd_cex: "BINANCE CEX",
        cmd_web3: "BINANCE WALLET",
        cmd_dex: "ASTER DEX",
        sect_market: "MARKET OVERVIEW",
        stat_active: "ACTIVE POOLS",
        stat_pool: "TOTAL REWARDS",
        stat_top_reward: "HIGHEST REWARD",
        health_title: "MARKET RADAR",
        health_realtime: "Real-time",
        col_token: "TOKEN",
        col_duration: "TIME",
        col_win_pool: "WIN / POOL",
        col_price_val: "VAL / PRICE",
        col_rule: "RULE",
        col_min_vol: "MIN VOL",
        col_daily_vol: "DAILY VOL",
        col_camp_vol: "TOTAL VOL",
        col_speed: "SPEED",
        col_match: "SPD / MATCH",
        col_ord_spr: "ORD / SPR",
        col_target: "PREDICTION",

        tip_time: "Start - End Date & Countdown",
        tip_win_pool: "Top Winners & Pool Size",
        tip_price_val: "Est. Total Value & Token Price",
        tip_rule: "Trading Rule: Buy Only or Buy + Sell",
        tip_min_vol: "Minimum volume required to qualify for rewards (Rank Cut-off). Updated T+1.",
        tip_daily_vol: "Real-time Vol (Sub: Yesterday)",
        tip_camp_vol: "Total cumulative volume from the start of the tournament until now.",
        tip_speed_match: "Match Vol & Execution Speed",
        tip_ord_spr: "Avg Order Value & Spread %",

        // --- MODEL TOOLTIPS (UPDATED) ---
        // 1. Header Hover (Methodology) - THÊM DÒNG 30 PHÚT
        tip_pred_header_title: "MODEL METHODOLOGY",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>Data Basis:</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>Formula:</b> Aggregates previous session's Min Vol and real-time transaction Velocity.</li>
                <li><b>Range:</b> Model activates from <b style="color:#00F0FF">05:00 UTC</b> on the final day.</li>
                <li><b>Update:</b> Model automatically recalculates every 30 minutes.</li>
                <li><b>Adjustment:</b> Applies variable coefficients based on participant count and market depth.</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ DISCLAIMER:
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    Figures are for reference only and <b>do not constitute financial advice</b>. You are solely responsible for your trading decisions.
                </div>
            </div>`,

        // 2. Cell Hover (Active State)
        tip_model_title: "MODEL PROJECTION",
        tip_model_active: "Target is projected based on historical volatility, real-time momentum, and liquidity depth.",
        tip_vote_guide: "Sentiment? Vote <b class='text-brand'>Agree</b>, <b class='text-danger'>Lower</b> or <b class='text-success'>Higher</b>.",

        // 3. Cell Hover (Waiting State)
        tip_model_wait_title: "DATA ACCUMULATION",
        tip_model_wait_body: "Model requires comprehensive session data. Projection activates <span style='color:#ffd700'>16 hours</span> before close.",

        txt_ended: "Ended",
        txt_yest: "Yest",
        txt_new: "NEW",
        txt_no_data: "No Data",
        txt_ops: "ops",
        rule_buy: "ONLY BUY",
        rule_buy_sell: "BUY + SELL",
        rule_limit_x4: "Trade Limit x4",
        rule_all: "ALL VOL",
        rule_x4: "ALL VOL x4",
        tag_x4: "X4 BSC",
        tag_x2: "X2 OTHER",
        sect_deadline: "DEADLINE RADAR",
        btn_view_all: "View All",
        sect_board: "TRACKING BOARD",
        btn_create: "CREATE",
        btn_config: "Site Config",
        card_top: "TOP",
        card_reward: "REWARD",
        card_price: "PRICE",
        card_my_prog: "MY PROGRESS",
        card_update: "UPDATE VOL",
        card_total_vol: "Total Vol (Alpha)",
        card_min_target: "Min Target (Goal)",
        btn_predict: "PREDICT",
        btn_market_closed: "MARKET CLOSED",
        leg_title: "METRIC LEGEND",
        leg_price: "Current market price (Live).",
        leg_reward: "Est. Prize Value (Qty * Price).",
        leg_min_vol: "Target Vol (Yesterday vs Day-2).",
        leg_daily_vol: "Real-time Vol (Sub: Yesterday).",
        leg_camp_vol: "Total accumulated volume since start.",
        leg_speed: "Execution speed (Orders/sec).",
        leg_match: "Avg market absorption per second ($).",
        leg_ord: "Average value per single order ($).",
        leg_spread: "Bid/Ask price gap (%).",
        modal_login_title: "SECURE ACCESS",
        modal_login_desc: "Authenticate via Email OTP",
        btn_send_code: "SEND CODE",
        btn_verify: "VERIFY LOGIN",
        modal_update_title: "MY TRADING TRACKER",
        lbl_date: "DATE",
        lbl_acc_vol: "MY VOLUMES & GAP",
        lbl_history: "MY HISTORY",
        btn_save_prog: "SAVE MY PROGRESS",
        modal_pred_title: "ENTER PREDICTION",
        modal_pred_desc: "Predict the final Min Volume.",
        lbl_your_name: "YOUR NAME",
        lbl_your_guess: "YOUR GUESS (VOL)",
        btn_pay_fee: "CONFIRM & PAY FEE",
        toast_login: "Please Login first!",
        toast_success: "Action Successful!",
        toast_error: "Error occurred!",
        toast_saved: "Data Saved!",
        toast_copied: "Copied to clipboard!",
        guide_title: "QUICK START GUIDE",
        guide_s1_t: "STEP 1: SETUP LIST",
        guide_s1_d: "Define your tracking list (e.g. Account A, Account B).",
        guide_s2_t: "STEP 2: INPUT VOLUME",
        guide_s2_d: "Click UPDATE on any tournament. Manually input volume.",
        guide_s3_t: "STEP 3: TRACK GAP",
        guide_s3_d: "System automatically calculates the GAP to Min Volume.",
        btn_setup_list: "SETUP MY LIST",
        leg_feedback_t: "Feedback / Support",
        leg_feedback_d: "Send ideas or report bugs.",
        leg_wallet_t: "Manage Wallets",
        leg_wallet_d: "Add or remove tracking accounts.",
        leg_login_t: "Login",
        leg_login_d: "Access Admin features.",
        stat_create: "CREATE"
    },

    /* ==========================================================
       2. TIẾNG VIỆT (VI)
       ========================================================== */
    vi: {
        nav_sys_time: "GIỜ HỆ THỐNG",
        nav_guide: "HƯỚNG DẪN",
        nav_login: "Đăng nhập",
        nav_logout: "Đăng xuất",
        nav_wallet: "Quản lý Ví",
        nav_feedback: "Góp ý",
        hero_title: "CÔNG CỤ THEO DÕI VOLUME",
        hero_sub: "Quản lý tài khoản & Tham gia dự đoán.",
        cmd_eco: "HỆ SINH THÁI",
        cmd_platform: "SÀN GIAO DỊCH",
        cmd_miniapp: "Mini App",
        cmd_channel: "Kênh Tin Tức",
        cmd_bot: "Bot Data",
        cmd_cex: "SÀN BINANCE",
        cmd_web3: "VÍ BINANCE",
        cmd_dex: "SÀN ASTER",
        sect_market: "TỔNG QUAN THỊ TRƯỜNG",
        stat_active: "GIẢI ĐANG CHẠY",
        stat_pool: "TỔNG GIẢI THƯỞNG",
        stat_top_reward: "THƯỞNG CAO NHẤT",
        health_title: "RADAR THỊ TRƯỜNG",
        health_realtime: "Thời gian thực",
        col_token: "TOKEN",
        col_duration: "THỜI GIAN",
        col_win_pool: "WIN / POOL",
        col_price_val: "GT / GIÁ",
        col_rule: "LUẬT",
        col_min_vol: "MỤC TIÊU",
        col_daily_vol: "VOL HÔM NAY",
        col_camp_vol: "TỔNG VOL",
        col_speed: "TỐC ĐỘ",
        col_match: "KHỚP/TỐC ĐỘ",
        col_ord_spr: "LỆNH / SPR",
        col_target: "DỰ ĐOÁN",

        tip_time: "Ngày bắt đầu - Kết thúc & Đếm ngược",
        tip_win_pool: "Số người thắng & Tổng giải",
        tip_price_val: "Tổng giá trị ước tính & Giá Token",
        tip_rule: "Luật giao dịch: Chỉ Mua hoặc Mua + Bán",
        tip_min_vol: "Khối lượng tối thiểu để lọt Top nhận thưởng (Vol chốt sổ). Cập nhật T+1.",
        tip_daily_vol: "Vol thực tế (Dòng dưới: Hôm qua)",
        tip_camp_vol: "Tổng khối lượng tích lũy tính từ khi bắt đầu giải cho đến hiện nay.",
        tip_speed_match: "Tốc độ khớp & Volume khớp lệnh",
        tip_ord_spr: "Giá trị trung bình lệnh & Chênh lệch giá",

        // --- MODEL TOOLTIPS (UPDATED) ---
        tip_pred_header_title: "PHƯƠNG PHÁP TÍNH",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>Cơ sở Dữ liệu:</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>Công thức:</b> Tổng hợp Min Vol phiên trước và Tốc độ giao dịch thực (Velocity).</li>
                <li><b>Phạm vi:</b> Mô hình kích hoạt từ <b style="color:#00F0FF">05:00 UTC</b> ngày cuối cùng.</li>
                <li><b>Cập nhật:</b> Mô hình tự động tính toán lại sau mỗi 30 phút.</li>
                <li><b>Điều chỉnh:</b> Áp dụng hệ số biến thiên dựa trên số người tham gia và độ sâu thị trường.</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ MIỄN TRỪ TRÁCH NHIỆM:
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    Số liệu chỉ mang tính tham khảo và <b>không phải lời khuyên tài chính</b>. Bạn hoàn toàn chịu trách nhiệm về quyết định giao dịch của mình.
                </div>
            </div>`,

        tip_model_title: "MÔ HÌNH DỰ ĐOÁN",
        tip_model_active: "Mục tiêu dựa trên biến động lịch sử và đà tăng trưởng thực tế.",
        tip_vote_guide: "Quan điểm? <b class='text-brand'>Đồng ý</b>, <b class='text-danger'>Thấp hơn</b> hay <b class='text-success'>Cao hơn</b>.",
        tip_model_wait_title: "ĐANG THU THẬP DỮ LIỆU",
        tip_model_wait_body: "Mô hình cần dữ liệu phiên đầy đủ. Dự đoán kích hoạt <span style='color:#ffd700'>16 giờ</span> trước khi đóng phiên.",

        txt_ended: "Kết thúc",
        txt_yest: "H.Qua",
        txt_new: "MỚI",
        txt_no_data: "Chưa có",
        txt_ops: "lệnh/s",
        rule_buy: "CHỈ MUA",
        rule_buy_sell: "MUA + BÁN",
        rule_limit_x4: "Lệnh Limit x4",
        rule_all: "MUA + BÁN",
        rule_x4: "MUA + BÁN (x4)",
        tag_x4: "X4 MẠNG BSC",
        tag_x2: "X2 MẠNG KHÁC",
        sect_deadline: "LỊCH CHỐT SỔ",
        btn_view_all: "Xem Tất Cả",
        sect_board: "BẢNG THEO DÕI",
        btn_create: "TẠO GIẢI",
        btn_config: "Cấu hình",
        card_top: "TOP",
        card_reward: "THƯỞNG",
        card_price: "GIÁ",
        card_my_prog: "TIẾN ĐỘ CỦA TÔI",
        card_update: "CẬP NHẬT VOL",
        card_total_vol: "Tổng Vol (Alpha)",
        card_min_target: "Mục Tiêu Min (Goal)",
        btn_predict: "DỰ ĐOÁN",
        btn_market_closed: "ĐÃ ĐÓNG SỔ",
        leg_title: "CHÚ THÍCH THÔNG SỐ",
        leg_price: "Giá thị trường hiện tại (Live).",
        leg_reward: "Giá trị giải thưởng (Qty * Price).",
        leg_min_vol: "Mục tiêu (So sánh Hôm qua vs Hôm kia).",
        leg_daily_vol: "Vol thực (Dòng dưới: Vol hôm qua).",
        leg_camp_vol: "Tổng volume tích lũy từ khi bắt đầu.",
        leg_speed: "Tốc độ khớp lệnh (Lệnh/giây).",
        leg_match: "Thanh khoản trung bình mỗi giây ($).",
        leg_ord: "Giá trị trung bình 1 lệnh ($).",
        leg_spread: "Chênh lệch giá Mua/Bán (%).",
        modal_login_title: "ĐĂNG NHẬP",
        modal_login_desc: "Xác thực qua Email OTP",
        btn_send_code: "GỬI MÃ CODE",
        btn_verify: "XÁC NHẬN",
        modal_update_title: "CẬP NHẬT TIẾN ĐỘ",
        lbl_date: "NGÀY",
        lbl_acc_vol: "VOL VÀ KHOẢNG CÁCH",
        lbl_history: "LỊCH SỬ NHẬP",
        btn_save_prog: "LƯU TIẾN ĐỘ",
        modal_pred_title: "DỰ ĐOÁN",
        modal_pred_desc: "Dự đoán Min Volume chốt sổ.",
        lbl_your_name: "TÊN BẠN",
        lbl_your_guess: "DỰ ĐOÁN (VOL)",
        btn_pay_fee: "XÁC NHẬN & TRẢ PHÍ",
        toast_login: "Vui lòng đăng nhập trước!",
        toast_success: "Thao tác thành công!",
        toast_error: "Có lỗi xảy ra!",
        toast_saved: "Dữ liệu đã lưu!",
        toast_copied: "Đã sao chép!",
        guide_title: "HƯỚNG DẪN NHANH",
        guide_s1_t: "BƯỚC 1: TẠO DANH SÁCH",
        guide_s1_d: "Định nghĩa các ví cần theo dõi.",
        guide_s2_t: "BƯỚC 2: NHẬP VOLUME",
        guide_s2_d: "Bấm CẬP NHẬT trên thẻ giải đấu.",
        guide_s3_t: "BƯỚC 3: THEO DÕI GAP",
        guide_s3_d: "Hệ thống tự động tính khoảng cách.",
        btn_setup_list: "CÀI ĐẶT DANH SÁCH",
        leg_feedback_t: "Góp ý / Hỗ trợ",
        leg_feedback_d: "Gửi ý tưởng hoặc báo lỗi.",
        leg_wallet_t: "Quản lý Ví",
        leg_wallet_d: "Thêm hoặc xóa ví theo dõi.",
        leg_login_t: "Đăng nhập",
        leg_login_d: "Truy cập tính năng Admin.",
        stat_create: "TẠO GIẢI"
    },

    /* ==========================================================
       3. TIẾNG TRUNG (ZH)
       ========================================================== */
    zh: {
        nav_sys_time: "系统时间",
        nav_guide: "指南",
        nav_login: "登录",
        nav_logout: "登出",
        nav_wallet: "钱包管理",
        nav_feedback: "反馈",
        hero_title: "锦标赛成交量追踪",
        hero_sub: "管理账户并参与预测。",
        cmd_eco: "生态系统",
        cmd_platform: "交易平台",
        cmd_miniapp: "小程序",
        cmd_channel: "频道",
        cmd_bot: "机器人",
        cmd_cex: "币安交易所",
        cmd_web3: "币安钱包",
        cmd_dex: "ASTER去中心化",
        sect_market: "市场概览",
        stat_active: "进行中奖池",
        stat_pool: "总奖励价值",
        stat_top_reward: "最高奖励",
        health_title: "市场雷达",
        health_realtime: "实时",
        col_token: "代币",
        col_duration: "时间",
        col_win_pool: "赢家 / 奖池",
        col_price_val: "价值 / 价格",
        col_rule: "规则",
        col_min_vol: "最低量",
        col_daily_vol: "今日量",
        col_camp_vol: "累计量",
        col_speed: "速度",
        col_match: "撮合",
        col_ord_spr: "均单 / 价差",
        col_target: "模型预测",

        tip_time: "开始 - 结束日期 & 倒计时",
        tip_win_pool: "获奖人数 & 奖池大小",
        tip_price_val: "预估总价值 & 代币价格",
        tip_rule: "交易规则：仅买入 或 全部量",
        tip_min_vol: "获得奖励所需的最低交易量 (排名截止)。T+1 更新。",
        tip_daily_vol: "实时量 (下方：昨日)",
        tip_camp_vol: "从比赛开始到现在的累计总交易量。",
        tip_speed_match: "撮合量 & 执行速度",
        tip_ord_spr: "平均订单价值 & 价差 %",

        // --- MODEL TOOLTIPS (UPDATED) ---
        tip_pred_header_title: "模型方法论",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>数据基础：</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>公式：</b> 综合上一时段的最小成交量和实时交易速度。</li>
                <li><b>范围：</b> 模型在最后一天的 <b style="color:#00F0FF">05:00 UTC</b> 激活。</li>
                <li><b>更新：</b> 模型每 30 分钟自动重新计算一次。</li>
                <li><b>调整：</b> 根据参与人数和市场深度应用可变系数。</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ 免责声明：
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    数据仅供参考，<b>不构成财务建议</b>。您需对自己的交易决定全权负责。
                </div>
            </div>`,

        tip_model_title: "模型预测",
        tip_model_active: "目标量基于历史波动率、实时动量和流动性深度计算得出。仅供参考。",
        tip_vote_guide: "您的观点？投票 <b class='text-brand'>赞同</b>，<b class='text-danger'>看低</b> 或 <b class='text-success'>看高</b>。",
        tip_model_wait_title: "数据积累中",
        tip_model_wait_body: "模型需要完整的数据谱。预测将在结束前 <span style='color:#ffd700'>16小时</span> 激活，以确保最高准确性。",

        txt_ended: "已结束",
        txt_yest: "昨",
        txt_new: "新",
        txt_no_data: "无数据",
        txt_ops: "单/秒",
        rule_buy: "仅买入",
        rule_buy_sell: "买入 + 卖出",
        rule_limit_x4: "限价单 x4",
        rule_all: "买入 + 卖出",
        rule_x4: "全量 x4",
        tag_x4: "X4 BSC链",
        tag_x2: "X2 其他链",
        sect_deadline: "截止雷达",
        btn_view_all: "查看全部",
        sect_board: "追踪面板",
        btn_create: "创建",
        btn_config: "配置",
        card_top: "排名",
        card_reward: "奖励",
        card_price: "价格",
        card_my_prog: "我的进度",
        card_update: "更新量",
        card_total_vol: "总成交量 (Alpha)",
        card_min_target: "最低目标 (Min)",
        btn_predict: "预测",
        btn_market_closed: "市场已关闭",
        leg_title: "指标说明",
        leg_price: "当前市场价格 (实时)。",
        leg_reward: "预估奖池价值 (数量 * 价格)。",
        leg_min_vol: "目标量变化 (对比上次更新)。",
        leg_daily_vol: "实时量 (下方: 昨日)。",
        leg_camp_vol: "自开始以来的累计交易量。",
        leg_speed: "交易速度 (订单/秒)。",
        leg_match: "每秒平均吸筹 ($)。",
        leg_ord: "单笔订单平均值 ($)。",
        leg_spread: "买卖价差 (Spread %)。",
        modal_login_title: "安全登录",
        modal_login_desc: "通过邮箱 OTP 验证",
        btn_send_code: "发送验证码",
        btn_verify: "验证登录",
        modal_update_title: "我的交易追踪",
        lbl_date: "日期",
        lbl_acc_vol: "我的成交量 & 差距",
        lbl_history: "历史记录",
        btn_save_prog: "保存进度",
        modal_pred_title: "输入预测",
        modal_pred_desc: "预测最终最低成交量。",
        lbl_your_name: "您的昵称",
        lbl_your_guess: "预测值 (VOL)",
        btn_pay_fee: "确认并支付",
        toast_login: "请先登录!",
        toast_success: "操作成功!",
        toast_error: "发生错误!",
        toast_saved: "数据已保存!",
        toast_copied: "已复制!",
        guide_title: "快速入门指南",
        guide_s1_t: "步骤 1: 设置列表",
        guide_s1_d: "定义您的追踪列表。",
        guide_s2_t: "步骤 2: 输入交易量",
        guide_s2_d: "点击更新 (UPDATE)。",
        guide_s3_t: "步骤 3: 追踪差距",
        guide_s3_d: "系统自动计算差距 (GAP)。",
        btn_setup_list: "设置我的列表",
        leg_feedback_t: "反馈 / 支持",
        leg_feedback_d: "发送想法或报告错误。",
        leg_wallet_t: "钱包管理",
        leg_wallet_d: "添加或删除追踪账户。",
        leg_login_t: "登录",
        leg_login_d: "访问管理员功能。",
        stat_create: "创建"
    },

    /* ==========================================================
       4. TIẾNG HÀN (KO)
       ========================================================== */
    ko: {
        nav_sys_time: "시스템 시간",
        nav_guide: "가이드",
        nav_login: "로그인",
        nav_logout: "로그아웃",
        nav_wallet: "지갑 관리",
        nav_feedback: "피드백",
        hero_title: "토너먼트 거래량 트래커",
        hero_sub: "계정을 관리하고 예측에 참여하세요.",
        cmd_eco: "생태계",
        cmd_platform: "거래 플랫폼",
        cmd_miniapp: "미니 앱",
        cmd_channel: "채널",
        cmd_bot: "봇",
        cmd_cex: "바이낸스 CEX",
        cmd_web3: "바이낸스 지갑",
        cmd_dex: "ASTER DEX",
        sect_market: "시장 개요",
        stat_active: "진행 중인 풀",
        stat_pool: "총 보상",
        stat_top_reward: "최고 보상",
        health_title: "시장 레이더",
        health_realtime: "실시간",
        col_token: "토큰",
        col_duration: "시간",
        col_win_pool: "승자 / 풀",
        col_price_val: "가치 / 가격",
        col_rule: "규칙",
        col_min_vol: "최소 거래량",
        col_daily_vol: "일일 거래량",
        col_camp_vol: "누적 거래량",
        col_speed: "속도",
        col_match: "체결",
        col_ord_spr: "평균 / 스프레드",
        col_target: "예측 모델",

        tip_time: "시작 - 종료 날짜 & 카운트다운",
        tip_win_pool: "최고 당첨자 & 풀 크기",
        tip_price_val: "총 추정 가치 & 토큰 가격",
        tip_rule: "거래 규칙: 매수 전용 또는 전체",
        tip_min_vol: "보상을 받기 위한 최소 거래량 (커트라인). T+1 업데이트.",
        tip_daily_vol: "실시간 볼륨 (하단: 어제)",
        tip_camp_vol: "대회 시작부터 현재까지의 누적 총 거래량.",
        tip_speed_match: "매칭 볼륨 & 체결 속도",
        tip_ord_spr: "평균 주문 가치 & 스프레드 %",

        // --- MODEL TOOLTIPS (UPDATED) ---
        tip_pred_header_title: "모델 방법론",
        tip_pred_header_body: `
            <div style="margin-bottom:8px; border-bottom:1px dashed #555; padding-bottom:6px; color:#ccc">
                <b>데이터 기준:</b>
            </div>
            <ul style='margin: 0; padding-left: 15px; list-style-type: circle; color:#bbb; line-height: 1.5; margin-bottom: 10px;'>
                <li><b>공식:</b> 이전 세션의 최소 거래량과 실시간 거래 속도를 집계합니다.</li>
                <li><b>범위:</b> 모델은 마지막 날 <b style="color:#00F0FF">05:00 UTC</b>부터 활성화됩니다.</li>
                <li><b>업데이트:</b> 모델은 30분마다 자동으로 다시 계산됩니다.</li>
                <li><b>조정:</b> 참여자 수와 시장 깊이에 따라 가변 계수를 적용합니다.</li>
            </ul>
            <div style="border-top: 1px solid #444; padding-top: 8px; margin-top: 8px;">
                <div style="color: #F6465D; font-size: 0.85em; line-height: 1.4; font-weight: 500;">
                    ⚠ 면책 조항:
                </div>
                <div style="color: #888; font-size: 0.8em; font-style: italic; line-height: 1.3; margin-top: 2px;">
                    수치는 참고용이며 <b>재정적 조언이 아닙니다</b>. 거래 결정에 대한 책임은 전적으로 본인에게 있습니다.
                </div>
            </div>`,

        tip_model_title: "모델 예측",
        tip_model_active: "목표 거래량은 과거 변동성과 실시간 시장 모멘텀을 기반으로 산출됩니다 (투자 조언 아님).",
        tip_vote_guide: "당신의 관점은? <b class='text-brand'>동의</b>, <b class='text-danger'>낮음</b> 또는 <b class='text-success'>높음</b> 투표.",
        tip_model_wait_title: "데이터 수집 중",
        tip_model_wait_body: "모델은 포괄적인 데이터가 필요합니다. 정확성을 위해 종료 <span style='color:#ffd700'>16시간 전</span>에 예측이 활성화됩니다.",

        txt_ended: "종료됨",
        txt_yest: "어제",
        txt_new: "신규",
        txt_no_data: "데이터 없음",
        txt_ops: "주문/초",
        rule_buy: "매수 전용",
        rule_buy_sell: "매수 + 매도",
        rule_limit_x4: "지정가 x4",
        rule_all: "매수 + 매도",
        rule_x4: "전체 볼륨 x4",
        tag_x4: "X4 BSC 체인",
        tag_x2: "X2 기타 체인",
        sect_deadline: "마감 레이더",
        btn_view_all: "모두 보기",
        sect_board: "추적 보드",
        btn_create: "생성",
        btn_config: "설정",
        card_top: "순위",
        card_reward: "보상",
        card_price: "가격",
        card_my_prog: "나의 진행 상황",
        card_update: "거래량 업데이트",
        card_total_vol: "총 거래량 (Alpha)",
        card_min_target: "최소 목표 (Goal)",
        btn_predict: "예측하기",
        btn_market_closed: "시장 마감",
        leg_title: "지표 범례",
        leg_price: "현재 시장 가격 (실시간).",
        leg_reward: "예상 상금 가치 (수량 * 가격).",
        leg_min_vol: "목표 거래량 변화 (지난 업데이트 대비).",
        leg_daily_vol: "실시간 볼륨 (하단: 어제).",
        leg_camp_vol: "시작 이후 누적 거래량.",
        leg_speed: "체결 속도 (주문/초).",
        leg_match: "초당 평균 매수 ($).",
        leg_ord: "주문당 평균 가치 ($).",
        leg_spread: "매수/매도 스프레드 (%).",
        modal_login_title: "보안 접속",
        modal_login_desc: "이메일 OTP 인증",
        btn_send_code: "코드 전송",
        btn_verify: "로그인 확인",
        modal_update_title: "거래 추적기",
        lbl_date: "날짜",
        lbl_acc_vol: "나의 볼륨 & 격차",
        lbl_history: "나의 기록",
        btn_save_prog: "진행 상황 저장",
        modal_pred_title: "예측 입력",
        modal_pred_desc: "최종 최소 거래량을 예측하세요.",
        lbl_your_name: "닉네임",
        lbl_your_guess: "예측값 (VOL)",
        btn_pay_fee: "확인 및 수수료 지불",
        toast_login: "먼저 로그인해주세요!",
        toast_success: "작업 성공!",
        toast_error: "오류가 발생했습니다!",
        toast_saved: "데이터 저장됨!",
        toast_copied: "복사됨!",
        guide_title: "빠른 시작 가이드",
        guide_s1_t: "1단계: 리스트 설정",
        guide_s1_d: "추적할 리스트를 정의하세요.",
        guide_s2_t: "2단계: 거래량 입력",
        guide_s2_d: "업데이트(UPDATE)를 클릭하세요.",
        guide_s3_t: "3단계: 격차 추적",
        guide_s3_d: "격차(GAP)를 시스템이 자동 계산합니다.",
        btn_setup_list: "내 리스트 설정",
        leg_feedback_t: "피드백 / 지원",
        leg_feedback_d: "아이디어 전송 또는 버그 신고.",
        leg_wallet_t: "지갑 관리",
        leg_wallet_d: "추적 계정 추가 또는 제거.",
        leg_login_t: "로그인",
        leg_login_d: "관리자 기능 액세스.",
        stat_create: "생성"
    }
};

/* --- HÀM KHỞI TẠO TOOLTIP (PHIÊN BẢN CHUẨN: HOVER ĐỂ XEM, CLICK RA NGOÀI ĐỂ TẮT) --- */
let globalTooltipInstances = []; // Biến lưu danh sách tooltip để quản lý tắt mở

function initSmartTooltips() {
    try {
        // 1. Dọn dẹp rác cũ
        document.querySelectorAll('.tooltip').forEach(t => t.remove());
        globalTooltipInstances = []; // Reset danh sách

        // 2. Xóa sự kiện click global cũ (tránh bị double sự kiện khi reload)
        document.removeEventListener('click', handleGlobalClick);
        document.addEventListener('click', handleGlobalClick);

        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));

        tooltipTriggerList.map(function (el) {
            // Hủy instance cũ nếu có
            const oldInstance = bootstrap.Tooltip.getInstance(el);
            if (oldInstance) oldInstance.dispose();

            // 3. Cấu hình: 'hover' (cho chuột) VÀ 'click' (cho cảm ứng/chuột click)
            let t = new bootstrap.Tooltip(el, {
                trigger: 'hover click', 
                html: true,
                animation: true,
                delay: { "show": 50, "hide": 50 },
                // Giữ tooltip hiển thị khi rê chuột vào chính cái tooltip đó (để copy text)
                interactive: true 
            });

            globalTooltipInstances.push(t);

            // 4. Xử lý xung đột khi click vào icon
            el.addEventListener('click', function (e) {
                // Ngăn sự kiện này lan ra document (để không kích hoạt hàm tắt ngay lập tức)
                e.stopPropagation();
                
                // Nếu là cột AI Target thì hiện luôn
                if(el.classList.contains('col-ai-target')) {
                    t.show();
                }
            });
            
            // Xử lý khi rê chuột ra (chỉ dành cho Desktop)
            el.addEventListener('mouseleave', function() {
                // Trên mobile không có mouseleave thực sự nên nó sẽ ko tắt ngay, đúng ý bạn
                t.hide(); 
            });

            return t;
        });

    } catch (e) {
        console.log("Tooltip error:", e);
    }
}

// --- HÀM XỬ LÝ CLICK RA NGOÀI (TAP OUTSIDE TO CLOSE) ---
function handleGlobalClick(e) {
    // Nếu cái được click KHÔNG PHẢI là một tooltip hoặc icon tooltip
    if (!e.target.closest('.tooltip') && !e.target.closest('[data-bs-toggle="tooltip"]')) {
        // Tắt tất cả các tooltip đang mở
        globalTooltipInstances.forEach(t => t.hide());
    }
}

/* ================= HÀM ĐỔI NGÔN NGỮ (ĐÃ FIX LỖI MARKET) ================= */
function changeLanguage(lang) {
    // 1. Cập nhật biến ngôn ngữ
    currentLang = lang;
    localStorage.setItem('wave_lang', lang);

    // 2. Đổi text trên nút chọn ngôn ngữ (nếu có)
    let langBtn = document.getElementById('cur-lang-text');
    if(langBtn) langBtn.innerText = lang.toUpperCase();

    // 3. Dịch các text tĩnh (Menu, Tiêu đề...)
    applyLanguage();

    // 4. Vẽ lại các thẻ bài (Card Grid)
    renderGrid();

    // --- [FIX QUAN TRỌNG] ---
    // 5. Bắt buộc vẽ lại bảng Market Health ngay lập tức
    if(typeof renderMarketHealthTable === 'function') {
        renderMarketHealthTable(); 
    }
}

function applyLanguage() {
    const t = translations[currentLang];
    
    // 1. Dịch text thông thường
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = t[key];
            } else {
                el.innerHTML = t[key]; // Dùng innerHTML để giữ icon nếu có
            }
        }
    });

    // 2. Dịch nội dung Tooltip
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        const key = el.getAttribute('data-i18n-tooltip');
        if (t[key]) {
            // Cập nhật title gốc
            el.setAttribute('title', t[key]);
            el.setAttribute('data-bs-original-title', t[key]);
            
            // Cập nhật nội dung Tooltip nếu nó đang hiển thị
            const tooltipInstance = bootstrap.Tooltip.getInstance(el);
            if (tooltipInstance) {
                tooltipInstance.setContent({ '.tooltip-inner': t[key] });
            }
        }
    });

    // 3. Dịch bộ lọc sắp xếp (nếu có)
    let sortSel = document.getElementById('sortFilter');
    if(sortSel) {
        sortSel.options[0].text = t.sort_newest;
        sortSel.options[1].text = t.sort_ending;
        sortSel.options[2].text = t.sort_reward;
    }
    initSmartTooltips();
}


    // V45 UX: CUSTOM TOAST SYSTEM
    function showToast(msg, type='info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast-item ${type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : '')}`;

        let icon = type === 'success' ? 'fa-check-circle text-green' : (type === 'error' ? 'fa-exclamation-triangle text-red' : 'fa-info-circle text-brand');

        toast.innerHTML = `<i class="fas ${icon} fa-lg"></i><div style="flex:1; font-size:0.9rem; font-weight:600; font-family:var(--font-main)">${msg}</div>`;

        container.appendChild(toast);
        // Play gentle sound
        if(type === 'error') playSfx('hover');
        else playSfx('click');

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    // Override native alert for better UX (Optional, but safe)
    window.alert = function(msg) { showToast(msg, 'info'); };

    // SFX ENGINE (V45)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playSfx(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        if(type === 'click') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if(type === 'hover') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(200, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc.start(); osc.stop(audioCtx.currentTime + 0.05);
        }
    }
    // Attach SFX to common elements
    document.querySelectorAll('button, .tour-card, .arsenal-card, .nav-link').forEach(el => {
        el.addEventListener('mouseenter', () => playSfx('hover'));
        el.addEventListener('click', () => playSfx('click'));
    });
    /* ========================================= */

    let marketChart = null, trackerChart = null, currentPolyId = null, compList = [];
    let siteConfig = { x:'', tele:'', yt:'', affiliate: {} };
    let accSettings = JSON.parse(localStorage.getItem('wave_settings')) || [{id:'acc1', name:'Main', color:'#00F0FF'}, {id:'acc2', name:'Clone', color:'#FFD700'}];
    let currentUser = null;
    let userProfile = null;

    const fmtNum = n => new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(n);
    const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n).replace('US$', '$').trim();
    const formatCurrency = (input) => {
        let val = input.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        input.value = val;
        if(input.id === 'u-min-vol') accSettings.forEach(acc => calcRowGap(acc.id));
    };

    if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        supabase.auth.onAuthStateChange((event, session) => {
            if (session) {
                currentUser = session.user;
                document.getElementById('loginBtn').classList.add('d-none');
                document.getElementById('userProfile').classList.remove('d-none');
                document.getElementById('userProfile').classList.add('d-flex');

                fetchUserProfile();
                checkUserAdmin();
                bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide();
            } else {
                currentUser = null;
                userProfile = null;
                document.getElementById('loginBtn').classList.remove('d-none');
                document.getElementById('userProfile').classList.add('d-none');
                document.getElementById('userProfile').classList.remove('d-flex');
                document.body.classList.remove('is-admin');
            }
        });
    }

// --- [SỬA LỖI] BIẾN CỜ CHỐNG ĐƠ & AUTO-WAKEUP ---
    let isSyncing = false; 
    let lastWakeupTime = 0;

   // --- [BẢN CẬP NHẬT FIX TOTAL VOL] ---
async function quickSyncData() {
    if (isSyncing || !supabase) return; 
    isSyncing = true;

    try {
        // Gọi hàm RPC mới (đã bao gồm Total Accumulated Vol)
        const { data, error } = await supabase.rpc('get_minimal_market_data');
        
        if (!error && data && data.length > 0) {
            let hasChanges = false;

            // --- SỬA LỖI 1: CHẶN REALTIME GHI ĐÈ VOL CỦA GIẢI ĐÃ END ---
data.forEach(miniRow => {
    let localItem = compList.find(c => c.db_id === miniRow.id);
    if (localItem) {
        // Kiểm tra xem giải đã kết thúc chưa
        let isEnded = false;
        if (localItem.end) {
            // Logic so sánh ngày đơn giản: Nếu ngày kết thúc nhỏ hơn hôm nay -> Ended
            let todayStr = new Date().toISOString().split('T')[0];
            if (localItem.end < todayStr) isEnded = true;
        }

        // --- CẬP NHẬT AI PREDICTION (Luôn cập nhật) ---
        if (miniRow.ai_prediction) {
            localItem.ai_prediction = miniRow.ai_prediction;
            hasChanges = true;
        }

        // --- 1. Cập nhật Daily Volume (QUAN TRỌNG: CHỈ CẬP NHẬT NẾU ĐANG CHẠY) ---
        // Nếu giải đã End, ta giữ nguyên Vol lịch sử, không cho Realtime ghi đè bằng 0
        if (!isEnded) {
            if (localItem.real_alpha_volume !== miniRow.real_alpha_volume) {
                localItem.real_alpha_volume = miniRow.real_alpha_volume;
                hasChanges = true;
            }
        }

        // --- 2. Cập nhật Total Accumulated Volume (Cũng chỉ nên cập nhật nếu đang chạy hoặc dữ liệu tăng lên) ---
        if (!isEnded && localItem.total_accumulated_volume !== miniRow.total_accumulated_volume) {
            localItem.total_accumulated_volume = miniRow.total_accumulated_volume;
            hasChanges = true;
        }

        // 3. Cập nhật Market Analysis
        if (JSON.stringify(localItem.market_analysis) !== JSON.stringify(miniRow.market_analysis)) {
            localItem.market_analysis = miniRow.market_analysis;
            hasChanges = true;
        }

        // 4. Cập nhật Tx Count
        if (!isEnded && localItem.daily_tx_count !== miniRow.daily_tx_count) {
            localItem.daily_tx_count = miniRow.daily_tx_count;
            hasChanges = true;
        }
    }
});

            if (hasChanges) {
                updateGridValuesOnly(); // Vẽ lại thẻ bài
                if (typeof renderMarketHealthTable === 'function') renderMarketHealthTable();
                renderStats();
                console.log("⚡ Data synced (Full Vol)");
            }
        }
    } catch (e) { 
        console.error("Sync Error:", e); 
    } finally {
        isSyncing = false; 
        //setTimeout(quickSyncData, 60000); 
    }
}

function init() {
    checkLegal();
    
    // --- 1. ƯU TIÊN HIỆN CACHE ---
    const cachedData = localStorage.getItem('wave_comp_list');
    let hasCache = false;

    if (cachedData) {
        try {
            compList = JSON.parse(cachedData);
            appData.running = compList; // [MỚI] Đồng bộ vào appData
            
            renderGrid();
            renderStats();
            hasCache = true;
            document.getElementById('loading-overlay').style.display = 'none';
            console.log("Loaded from Cache");
        } catch (e) { console.error(e); }
    }

    // --- 2. GỌI DỮ LIỆU MỚI (SỬA Ở ĐÂY) ---
    // Thay vì loadFromCloud, ta gọi initMarketRadar
    initMarketRadar().then(() => {
        // Tải xong mới bắt đầu kích hoạt vòng lặp cập nhật thông minh
        if (typeof quickSyncData === 'function') quickSyncData();
    });

    // 3. Đồng hồ hệ thống
    setInterval(updateClock, 1000);

    applyLanguage();
    if(document.getElementById('cur-lang-text')) {
        document.getElementById('cur-lang-text').innerText = currentLang.toUpperCase();
    }

    // --- 4. ĐĂNG KÝ REALTIME (ĐÃ FIX HỨNG TOTAL VOL) ---
    console.log("📡 Đang khởi tạo kết nối Realtime...");

    /*if (typeof supabase !== 'undefined') {
        supabase.removeAllChannels();

        supabase.channel('public:tournaments')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tournaments' }, (payload) => {
                const newData = payload.new;
                if (!newData) return;
                
                // 1. Cập nhật ngay vào bộ nhớ trình duyệt
                let localItem = compList.find(c => c.db_id === newData.id);
                if (localItem) {
                    let newContent = newData.data || newData.Data;
                    if (newContent) {
                        // --- [DÁN ĐOẠN NÀY VÀO] HỨNG DỮ LIỆU AI TỪ REALTIME ---
        if (newContent.ai_prediction) {
            localItem.ai_prediction = newContent.ai_prediction;
        }
                        // --- [FIX QUAN TRỌNG] HỨNG BIẾN TOTAL TÍCH LŨY ---
                        if (newContent.total_accumulated_volume) {
                            localItem.total_accumulated_volume = newContent.total_accumulated_volume;
                        }
                        // -------------------------------------------------

                        // Cập nhật Volume Daily
                        if (newContent.real_alpha_volume) localItem.real_alpha_volume = newContent.real_alpha_volume;
                        
                        // Cập nhật các thông số khác
                        if (newContent.market_analysis) localItem.market_analysis = newContent.market_analysis;
                        if (newContent.daily_tx_count) localItem.daily_tx_count = newContent.daily_tx_count;
                        if (newContent.real_vol_history) localItem.real_vol_history = newContent.real_vol_history;
                    }
                }

                // 2. VẼ LẠI GIAO DIỆN (Gọi hàm tổng hợp)
                if (typeof updateSingleCardUI === 'function') {
                    updateSingleCardUI(newData);
                } else {
                    // Fallback
                    updateGridValuesOnly();
                    if (typeof updateHealthTableRealtime === 'function') updateHealthTableRealtime();
                    renderStats();
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log("✅ Realtime Connected");
            });
    }*/

    // Modal hướng dẫn
    if (!localStorage.getItem('wave_guide_seen')) {
        setTimeout(() => {
            const guideEl = document.getElementById('guideModal');
            if(guideEl) new bootstrap.Modal(guideEl).show();
            localStorage.setItem('wave_guide_seen', 'true');
        }, 1500);
    }
}


    // --- HÀM checkAndAutoRefresh (KHÔNG CẦN DÙNG NỮA - ĐỂ TRỐNG) ---
    function checkAndAutoRefresh() {
        // Đã thay thế bằng QuickSync và Realtime
    }

    // --- GIỮ NGUYÊN 2 HÀM NÀY ---
    function checkLegal() {
        if (!localStorage.getItem('wave_legal_accepted')) document.getElementById('legalModal').style.display = 'flex';
    }
    function acceptLegal() {
        localStorage.setItem('wave_legal_accepted', 'true');
        document.getElementById('legalModal').style.display = 'none';
    }

    // --- [FIX V62] FETCH PROFILE & SYNC WALLET SETTINGS ---
async function fetchUserProfile() {
    if(!currentUser) return;
    
    // 1. Lấy dữ liệu từ Cloud
    const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    
    if(data) {
        userProfile = data;
        
        // Hiển thị tên & số dư
        document.getElementById('userNameDisplay').innerText = data.nickname || currentUser.email.split('@')[0];
        let bal = data.balance_usdt !== null ? data.balance_usdt : 0;
        document.getElementById('user-balance').innerText = fmtNum(bal);
        userProfile.balance_usdt = bal;

        checkDailyBonus();

        // 2. LẤY DỮ LIỆU TRACKER
        userProfile.tracker_data = data.tracker_data || {};

        // --- [FIX QUAN TRỌNG] ĐỒNG BỘ CẤU HÌNH VÍ TỪ CLOUD ---
        // Chúng ta quy ước key 'meta_wallets' trong tracker_data sẽ chứa cấu hình ví
        if (userProfile.tracker_data && userProfile.tracker_data.meta_wallets) {
            // Nếu trên Cloud có cấu hình ví -> Tải về máy dùng ngay
            accSettings = userProfile.tracker_data.meta_wallets;
            // Lưu đè vào LocalStorage để đồng bộ
            localStorage.setItem('wave_settings', JSON.stringify(accSettings));
        } else {
            // Nếu trên Cloud chưa có (User mới) -> Lấy từ LocalStorage hiện tại đẩy lên Cloud lần đầu
            // Để giữ lại các ví user đang dùng
            updateCloudWallets(); 
        }

        // 3. Avatar
        if(data.avatar_url) {
            document.getElementById('nav-avatar').src = data.avatar_url;
            document.getElementById('nav-avatar').style.display = 'block';
        } else {
            document.getElementById('nav-avatar').style.display = 'none';
        }

        // 4. Vẽ lại giao diện với cấu hình ví chuẩn của User đó
        renderGrid();
    }
}

    // V45 RETENTION: DAILY BONUS LOGIC
    async function checkDailyBonus() {
        if(!currentUser || !userProfile) return;
        const today = new Date().toISOString().split('T')[0];
        const lastClaimKey = 'wave_daily_claim_' + currentUser.id;
        const lastClaim = localStorage.getItem(lastClaimKey);

        if(lastClaim !== today) {
            const bonus = 100;
            const newBal = (userProfile.balance_usdt || 0) + bonus;

            // Optimistic UI Update
            userProfile.balance_usdt = newBal;
            document.getElementById('user-balance').innerText = fmtNum(newBal);

            showToast(`🎉 Daily Login Bonus: +${bonus} USDT!`, 'success');
            localStorage.setItem(lastClaimKey, today);

            // Sync to DB silently
            await supabase.from('profiles').update({ balance_usdt: newBal }).eq('id', currentUser.id);
        }
    }

    function openProfileModal() {
        if(!currentUser) return;
        document.getElementById('pf-nickname').value = userProfile?.nickname || '';
        document.getElementById('pf-avatar-url').value = userProfile?.avatar_url || '';

        let preview = document.getElementById('pf-preview');
        let placeholder = document.getElementById('pf-placeholder');
        if(userProfile?.avatar_url) {
            preview.src = userProfile.avatar_url;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            preview.style.display = 'none';
            placeholder.style.display = 'block';
        }
        new bootstrap.Modal(document.getElementById('profileModal')).show();
    }

    // V45 UPGRADE: Real Storage Upload
    async function handleFileUpload(input) {
        if(!input.files || input.files.length === 0) return;
        if(!currentUser) return showToast("Please Login", "error");

        const file = input.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;

        let placeholder = document.getElementById('pf-placeholder');
        let loader = document.getElementById('upload-loading');
        loader.style.display = 'flex';

        try {
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if(uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

            await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);

            document.getElementById('pf-avatar-url').value = publicUrl;
            document.getElementById('pf-preview').src = publicUrl;
            document.getElementById('pf-preview').style.display = 'block';
            placeholder.style.display = 'none';
            loader.style.display = 'none';
            showToast("Avatar updated successfully!", "success");
        } catch (error) {
            showToast("Upload failed: " + error.message, "error");
            loader.style.display = 'none';
        }
    }

    async function saveProfile() {
        const nickname = document.getElementById('pf-nickname').value.trim();
        const avatar_url = document.getElementById('pf-avatar-url').value.trim();
        const btn = document.getElementById('btn-save-profile');
        if(!nickname) return showToast("Nickname required", "error");
        btn.innerText = "SAVING..."; btn.disabled = true;
        const updates = { id: currentUser.id, nickname, avatar_url };
        const { error } = await supabase.from('profiles').upsert(updates);
        btn.innerText = "SAVE CHANGES"; btn.disabled = false;
        if(error) {
            if(error.code === '23505') showToast("Nickname already taken!", "error");
            else showToast(error.message, "error");
        } else {
            fetchUserProfile();
            bootstrap.Modal.getInstance(document.getElementById('profileModal')).hide();
            showToast("Profile Saved!", "success");
        }
    }

    // --- HÀM UPLOAD ẢNH CHUNG (Dùng cho cả Brand & Project) ---
    async function uploadImage(input, previewId, valueId) {
        if (!input.files || input.files.length === 0) return;
        let previewEl = document.getElementById(previewId);
        previewEl.style.opacity = '0.5';

        try {
            const file = input.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `img_${Date.now()}_${Math.floor(Math.random()*1000)}.${fileExt}`;
            const { error } = await supabase.storage.from('avatars').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            const publicUrl = data.publicUrl;
            document.getElementById(valueId).value = publicUrl;
            previewEl.src = publicUrl;
            previewEl.style.display = 'block';
            previewEl.style.opacity = '1';
        } catch (e) {
            showToast("Upload Error: " + e.message, "error");
            previewEl.style.opacity = '1';
        }
    }

    function openLoginModal() { resetLoginModal(); new bootstrap.Modal(document.getElementById('loginModal')).show(); }
    function resetLoginModal() { document.getElementById('login-step-1').style.display = 'block'; document.getElementById('login-step-2').style.display = 'none'; document.getElementById('otp-token').value = ''; }

    async function sendOtpCode() {
        const email = document.getElementById('otp-email').value.trim();
        if(!email) return showToast("Please enter email", "error");
        let btn = document.querySelector('#login-step-1 button');
        let oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...'; btn.disabled = true;
        try {
            const { error } = await supabase.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
            if (error) throw error;
            document.getElementById('login-step-1').style.display = 'none';
            document.getElementById('login-step-2').style.display = 'block';
            setTimeout(() => document.getElementById('otp-token').focus(), 500);
            showToast("OTP Code sent to " + email, "success");
        } catch (e) { showToast("Error sending code: " + e.message, "error"); }
        finally { btn.innerHTML = oldText; btn.disabled = false; }
    }

    async function verifyOtpCode() {
        const email = document.getElementById('otp-email').value.trim();
        const token = document.getElementById('otp-token').value.trim();
        if(!token) return showToast("Enter code", "error");
        let btn = document.querySelector('#login-step-2 button');
        let oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFYING...'; btn.disabled = true;
        try {
            const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
            if (error) {
                console.log("Retrying with signup type...");
                const { data: data2, error: error2 } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
                if (error2) throw error;
            }
            window.location.reload();
        } catch (e) { showToast("Invalid Code or Expired.", "error"); btn.innerHTML = oldText; btn.disabled = false; }
    }

    async function handleLogout() { 
    await supabase.auth.signOut(); 
    
    // --- [FIX] XÓA SẠCH DỮ LIỆU CỤC BỘ KHI LOGOUT ---
    localStorage.removeItem('wave_settings'); // Xóa cấu hình ví
    // Có thể xóa thêm các key khác nếu muốn sạch hơn
    
    window.location.reload(); 
}
    function checkUserAdmin() {
        if(currentUser && ADMIN_EMAILS.includes(currentUser.email)) document.body.classList.add('is-admin');
        else document.body.classList.remove('is-admin');
        renderGrid();
    }

    /* ==========================================================
   [BƯỚC 3 FIX FINAL v3] LOGIC TẢI DATA: RUNNING (JSON) vs ENDED (SQL)
   ========================================================== */

let appData = {
    running: [],        
    history: [],        
    isDataReady: false, 
    currentTab: 'running', // Mặc định là Running
    currentView: 'list',   // Mặc định là List (Radar)
    gridTab: 'running'     // Để tương thích code cũ
};

function switchViewMode(mode) {
    appData.currentView = mode;

    // Đổi màu nút
    const btnList = document.getElementById('btn-view-list');
    const btnGrid = document.getElementById('btn-view-grid');

    if (mode === 'list') {
        // Active nút Radar
        btnList.className = 'btn btn-sm btn-primary fw-bold';
        btnGrid.className = 'btn btn-sm btn-outline-secondary fw-bold text-sub border-0';
        
        // Hiện Bảng, Ẩn Thẻ
        document.getElementById('view-list-container').classList.remove('d-none');
        document.getElementById('view-grid-container').classList.add('d-none');
        
        // Vẽ lại bảng (Dùng code cũ của bạn)
        if(typeof renderMarketHealthTable === 'function') renderMarketHealthTable(); 
    } else {
        // Active nút Board
        btnGrid.className = 'btn btn-sm btn-primary fw-bold';
        btnList.className = 'btn btn-sm btn-outline-secondary fw-bold text-sub border-0';

        // Hiện Thẻ, Ẩn Bảng
        document.getElementById('view-grid-container').classList.remove('d-none');
        document.getElementById('view-list-container').classList.add('d-none');

        // Vẽ lại thẻ (Dùng code cũ của bạn)
        if(typeof renderGrid === 'function') renderGrid(); 
    }
}


function switchGlobalTab(tabName) {
    appData.currentTab = tabName;
    appData.gridTab = tabName; // Giữ biến cũ để tương thích ngược
    localStorage.setItem('wave_active_tab', tabName);
    
    // Đổi màu tab Running/History
    document.querySelectorAll('.radar-tab').forEach(el => {
        // So sánh ID để active đúng nút
        if(el.id === `tab-${tabName}`) el.classList.add('active');
        else el.classList.remove('active');
    });

    // Gọi lại các hàm vẽ cũ (giữ nguyên logic cũ bên trong các hàm này)
    if(typeof renderMarketHealthTable === 'function') renderMarketHealthTable();
    
    if (appData.currentView === 'grid') {
        if(typeof renderGrid === 'function') renderGrid();
    }
}


async function initMarketRadar() {
    console.log("🚀 System Starting...");
    
    // 1. Khôi phục Tab từ bộ nhớ
    let savedTab = localStorage.getItem('wave_active_tab') || 'running';
    appData.currentTab = savedTab;

    // 2. Active UI cho Tab đó
    document.querySelectorAll('.radar-tab').forEach(el => el.classList.remove('active'));
    let tabEl = document.getElementById(`tab-${savedTab}`);
    if(tabEl) tabEl.classList.add('active');

    // 3. Tải dữ liệu (SỬA LẠI CHỖ NÀY: Gọi đúng tên hàm mới)
    // Xóa hết mấy cái if/else cũ đi, chỉ để lại dòng này:
    await loadFromCloud(); 
    
    // 4. Auto refresh (Chạy ngầm) - Dùng QuickSync (RPC) thay vì Fetch Full Data
    setInterval(() => {
        // Chỉ chạy cái này (Nhẹ)
        if (typeof quickSyncData === 'function') {
            quickSyncData(); 
        }
    }, 60000); 

} 

    
// 3. HÀM CHUYỂN TAB (FIX: LƯU TRẠNG THÁI)
function switchRadarTab(type) {
    appData.currentTab = type;
    localStorage.setItem('wave_active_tab', type); // <--- LƯU VÀO BỘ NHỚ

    // UI
    document.querySelectorAll('.radar-tab').forEach(el => el.classList.remove('active'));
    let activeTab = document.getElementById(`tab-${type}`);
    if(activeTab) activeTab.classList.add('active');

    // Render
    if (type === 'running') {
        renderMarketHealthTable(appData.running); 
    } else {
        renderMarketHealthTable(appData.history);
    }
}

// --- [MỚI] HÀM CHUYỂN TAB CHO TRACKING BOARD (CARD GRID) ---
function switchGridTab(tabName) {
    // 1. Cập nhật trạng thái
    appData.gridTab = tabName;

    // 2. Cập nhật giao diện nút bấm (Active Class)
    // Giả sử bạn đặt ID nút là 'gtab-running' và 'gtab-history'
    document.querySelectorAll('.grid-tab-btn').forEach(el => el.classList.remove('active'));
    const btn = document.getElementById(`gtab-${tabName}`);
    if(btn) btn.classList.add('active');

    // 3. Vẽ lại lưới thẻ bài
    renderGrid();
}


/* ==========================================================
   4. HÀM GỌI API (ĐÃ SỬA LỖI FLASH NHẢY TAB TRONG CATCH BLOCK)
   ========================================================== */
async function loadFromCloud(isSilent = false) {
    // Chỉ hiện loading nếu không phải chạy ngầm (silent)
    if(!isSilent && !appData.isDataReady && document.getElementById('loading-overlay')) {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();

        // 1. Query dữ liệu
        let query = supabase.from('tournaments')
            .select(`*, tournament_history (vol, daily_vol, date, target, price, tx_count)`)
            .order('id', { ascending: true });

        const { data, error } = await query;
        if (error) throw error;

        let tempRunning = [], tempHistory = [], tempAll = []; 

        if (data && data.length > 0) {
            data.forEach(row => {
                if(row.id === -1) {
                    siteConfig = row.data || { x:'', tele:'', yt:'', affiliate:{} };
                    renderFooter(); renderArsenal(); renderCustomHub(); 
                } else {
                    let item = row.data || row.Data;
                    if (item) {
                        item.db_id = row.id; 
                        item.id = item.db_id;
                        
                        // --- A. PHÂN LOẠI RUNNING / HISTORY ---
                        let isRunning = true;
                        if (item.end) {
                            if (item.end < todayStr) isRunning = false;
                            else if (item.end === todayStr) {
                                let tPart = (item.endTime || "23:59:59").trim();
                                if(tPart.length === 5) tPart += ":00";
                                let endDate = new Date(`${item.end}T${tPart}Z`);
                                if (now > endDate) isRunning = false;
                            }
                        }

                        // --- B. XỬ LÝ SỐ LIỆU ---
                        if (!isRunning) {
                            // HISTORY TAB
                            let sqlList = row.tournament_history || [];
                            let endRecord = sqlList.find(h => h.date === item.end);
                            
                            if (!endRecord && sqlList.length > 0) {
                                sqlList.sort((a,b) => new Date(a.date) - new Date(b.date));
                                endRecord = sqlList[sqlList.length - 1];
                            }

                            if (endRecord) {
                                item.real_alpha_volume = endRecord.daily_vol; 
                                item.total_accumulated_volume = endRecord.vol;
                                item.cachedPrice = endRecord.price;
                                item.display_target = parseFloat(endRecord.target || 0);
                                
                                let d = new Date(endRecord.date); d.setDate(d.getDate() - 1);
                                let prevDateStr = d.toISOString().split('T')[0];
                                let prevRecord = sqlList.find(h => h.date === prevDateStr);
                                item.display_prev_target = prevRecord ? parseFloat(prevRecord.target || 0) : 0;

                                item.market_analysis = {
                                    price: endRecord.price, label: 'ENDED', spread: (item.market_analysis?.spread || 0),
                                    avgTicket: endRecord.daily_vol / (endRecord.tx_count || 1), realTimeVol: 0, velocity: 0
                                };
                            }
                        } 
                        else {
                            // RUNNING TAB
                            if (!item.real_vol_history) item.real_vol_history = [];
                            if (row.tournament_history) {
                                let sorted = row.tournament_history.sort((a,b) => new Date(a.date) - new Date(b.date));
                                let volMap = new Map(); item.real_vol_history.forEach(v => volMap.set(v.date, v));
                                sorted.forEach(s => {
                                    if(volMap.has(s.date)) volMap.get(s.date).vol = s.daily_vol;
                                    else item.real_vol_history.push({date:s.date, vol:s.daily_vol});
                                });
                                item.real_vol_history.sort((a,b) => new Date(a.date) - new Date(b.date));

                                let hToday = sorted.find(h => h.date === todayStr);
                                if(hToday && hToday.vol > 0) item.total_accumulated_volume = hToday.vol;

                                let d = new Date(); d.setDate(d.getDate()-1);
                                let t1 = d.toISOString().split('T')[0]; d.setDate(d.getDate()-1);
                                let t2 = d.toISOString().split('T')[0];
                                
                                if(!item.history) item.history = [];
                                let r1 = item.history.find(h => h.date === t1);
                                let r2 = item.history.find(h => h.date === t2);
                                
                                item.display_target = r1 ? parseFloat(r1.target) : 0;
                                item.display_prev_target = r2 ? parseFloat(r2.target) : 0;
                            }
                        }

                        if (isRunning) tempRunning.push(item);
                        else tempHistory.push(item);
                        tempAll.push(item);
                    }
                }
            });
        }

        // 2. Cập nhật dữ liệu
        appData.running = tempRunning.sort((a,b) => {
            if(!a.end) return 1; if(!b.end) return -1;
            return new Date(a.end) - new Date(b.end);
        });
        
        appData.history = tempHistory.sort((a,b) => new Date(b.end) - new Date(a.end)); 
        
        appData.isDataReady = true;
        compList = tempAll;
        localStorage.setItem('wave_comp_list', JSON.stringify(compList));

        // 3. Render UI & Stats
        renderGrid(); 
        renderStats();
        initCalendar();
        
        // Render đúng tab hiện tại
        let currentActiveTab = localStorage.getItem('wave_active_tab') || 'running';
        appData.currentTab = currentActiveTab; 
        
        if(currentActiveTab === 'running') {
            renderMarketHealthTable(appData.running);
        } else {
            renderMarketHealthTable(appData.history);
        }

    } catch (err) {
        console.error("Lỗi Fetch (Đã xử lý fallback):", err);
        
        // --- [FIX QUAN TRỌNG: FALLBACK THÔNG MINH KHI LỖI] ---
        const cached = localStorage.getItem('wave_comp_list');
        if(cached) { 
            let allItems = JSON.parse(cached);
            compList = allItems;

            // Phân loại lại từ Cache để không bị lẫn lộn
            const todayStr = new Date().toISOString().split('T')[0];
            appData.running = allItems.filter(c => !c.end || c.end >= todayStr);
            appData.history = allItems.filter(c => c.end && c.end < todayStr);

            // Chỉ vẽ lại đúng Tab đang mở
            let currentActiveTab = localStorage.getItem('wave_active_tab') || 'running';
            if (currentActiveTab === 'running') {
                renderMarketHealthTable(appData.running);
            } else {
                renderMarketHealthTable(appData.history);
            }
        }
    } finally {
        if(!isSilent && document.getElementById('loading-overlay')) {
            document.getElementById('loading-overlay').style.display = 'none';
        }
        updateAllPrices();
    }
}

        // --- CẬP NHẬT: PHÂN CHIA 2 HÀNG (CEX & DEX/WEB3) ---
        // --- BƯỚC 4: HÀM HIỂN THỊ DANH SÁCH ĐỘNG (ĐỌC TỪ CONFIG) ---
    function renderArsenal() {
        const container = document.getElementById('arsenal-grid');
        if(!container) return;

        // 1. Reset container
        container.className = '';
        container.innerHTML = '';

        // 2. LẤY DỮ LIỆU TỪ CẤU HÌNH ĐÃ LƯU (Quan trọng!)
        // Nếu chưa có dữ liệu thì dùng mảng rỗng
        let exchanges = siteConfig.arsenal_items || [];

        // 3. Nếu danh sách trống và là Admin -> Hiện nút nhắc nhở thêm sàn
        if(exchanges.length === 0) {
            if(document.body.classList.contains('is-admin')) {
                container.innerHTML = `<div class="col-12 text-center text-sub border border-dashed border-secondary p-3 rounded" onclick="openConfigModal()" style="cursor:pointer; font-size:0.8rem">Admin: Click to Add Trading Platforms</div>`;
            }
            return;
        }

        // 4. Phân loại CEX và DEX
        const listCEX = exchanges.filter(e => e.type === 'EXCHANGE');
        const listDEX = exchanges.filter(e => e.type !== 'EXCHANGE');

        // Hàm hỗ trợ vẽ thẻ
        const generateCards = (list) => {
            let html = '';
            list.forEach(ex => {
                // Chỉ hiện nếu có Link Ref
                if(ex.link) {
                    // Dùng logo mặc định nếu user chưa up logo
                    // (Tạo ảnh placeholder bằng chữ cái đầu của tên sàn)
                    let logoUrl = ex.logo || 'https://placehold.co/50x50/333/999?text=' + ex.name.charAt(0).toUpperCase();

                    html += `
                    <div class="arsenal-card" onclick="trackAffiliateClick('${ex.name}'); window.open('${ex.link}', '_blank'); playSfx('click')">
                        <img src="${logoUrl}" class="ex-logo">
                        <div class="ex-info">
                            <div class="ex-name">${ex.name}</div>
                            <div class="ex-bonus" style="opacity: 0.7; font-weight: normal;">${ex.type}</div>
                        </div>
                    </div>`;
                }
            });
            return html;
        };

        // 5. Render ra HTML
        let cexHtml = generateCards(listCEX);
        let dexHtml = generateCards(listDEX);

        // Hiển thị nhóm CEX
        if (cexHtml) {
            container.innerHTML += `<div class="text-sub small fw-bold mb-2 ps-1 text-uppercase" style="letter-spacing:1px; font-size:0.7rem"><i class="fas fa-building me-2"></i> CENTRALIZED EXCHANGES (CEX)</div>`;
            container.innerHTML += `<div class="arsenal-grid mb-4">${cexHtml}</div>`;
        }

        // Hiển thị nhóm DEX/WEB3
        if (dexHtml) {
            container.innerHTML += `<div class="text-sub small fw-bold mb-2 ps-1 text-uppercase" style="letter-spacing:1px; font-size:0.7rem"><i class="fas fa-wallet me-2"></i> DECENTRALIZED & WEB3</div>`;
            container.innerHTML += `<div class="arsenal-grid mb-2">${dexHtml}</div>`;
        }
    }


    // New Tracking Function
    function trackAffiliateClick(exchangeId) {
        console.log("Tracking Click:", exchangeId);
        // Gửi sự kiện lên GA4 (nếu đã config)
        if(typeof gtag === 'function') {
            gtag('event', 'click_affiliate', {
                'event_category': 'monetization',
                'event_label': exchangeId
            });
        }
    }

        // --- CẬP NHẬT: TỰ ĐỘNG SỬA LINK NẾU THIẾU HTTPS ---
    function renderFooter() {
        const c = document.getElementById('footer-socials-container');
        c.innerHTML = '';

        // Hàm nhỏ giúp kiểm tra và thêm https:// nếu thiếu
        const fixUrl = (url) => {
            if (!url) return '';
            // Nếu chưa có http hoặc https thì tự thêm vào
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return 'https://' + url;
            }
            return url;
        };

        if(siteConfig.x) c.innerHTML += `<a href="${fixUrl(siteConfig.x)}" target="_blank" class="social-btn"><i class="fab fa-twitter"></i></a>`;
        if(siteConfig.tele) c.innerHTML += `<a href="${fixUrl(siteConfig.tele)}" target="_blank" class="social-btn"><i class="fab fa-telegram-plane"></i></a>`;
        if(siteConfig.yt) c.innerHTML += `<a href="${fixUrl(siteConfig.yt)}" target="_blank" class="social-btn"><i class="fab fa-youtube"></i></a>`;

        // Render Brand Logo (Giữ nguyên phần logo)
        const brandImg = document.getElementById('nav-brand-img');
        const brandText = document.getElementById('nav-brand-text');
        if(brandText) brandText.style.display = 'block';
        if(siteConfig.brandLogo) {
            brandImg.src = siteConfig.brandLogo;
            brandImg.style.display = 'block';
        } else {
            brandImg.style.display = 'none';
        }
    }


    function openConfigModal() {
    // 1. Load Socials & Logo
    document.getElementById('cfg-x').value = siteConfig.x || '';
    document.getElementById('cfg-tele').value = siteConfig.tele || '';
    document.getElementById('cfg-yt').value = siteConfig.yt || '';
    document.getElementById('cfg-logo-url').value = siteConfig.brandLogo || '';
    
    // 2. [FIX] Load 3 Link Ref Chính
    document.getElementById('cfg-ref-binance').value = siteConfig.ref_binance || '';
    document.getElementById('cfg-ref-web3').value = siteConfig.ref_web3 || '';
    document.getElementById('cfg-ref-dex').value = siteConfig.ref_dex || '';

    // Preview Logo
    let img = document.getElementById('cfg-logo-preview');
    if(siteConfig.brandLogo) { img.src = siteConfig.brandLogo; img.style.display = 'block'; }
    else { img.style.display = 'none'; }

    // 3. Load Danh Sách Động (Arsenal)
    let arsenalList = siteConfig.arsenal_items || [];
    renderArsenalInputs(arsenalList);

    new bootstrap.Modal(document.getElementById('configModal')).show();
}


async function saveGlobalConfig() {
    // 1. Quét dữ liệu từ danh sách động (Arsenal)
    let arsenalItems = [];
    document.querySelectorAll('.arsenal-item-row').forEach(row => {
        arsenalItems.push({
            name: row.querySelector('.inp-name').value,
            link: row.querySelector('.inp-link').value,
            type: row.querySelector('.inp-type').value,
            logo: row.querySelector('.inp-logo').value
        });
    });

    // 2. Tạo object Config mới (BAO GỒM CẢ 3 LINK FIX MỚI)
    const newData = {
        x: document.getElementById('cfg-x').value.trim(),
        tele: document.getElementById('cfg-tele').value.trim(),
        yt: document.getElementById('cfg-yt').value.trim(),
        brandLogo: document.getElementById('cfg-logo-url').value.trim(),

        // [FIX] Lưu 3 Link Ref Chính
        ref_binance: document.getElementById('cfg-ref-binance').value.trim(),
        ref_web3: document.getElementById('cfg-ref-web3').value.trim(),
        ref_dex: document.getElementById('cfg-ref-dex').value.trim(),

        // Lưu mảng danh sách sàn phụ
        arsenal_items: arsenalItems
    };

    // 3. Gửi lên Server
    let btn = document.querySelector('button[onclick="saveGlobalConfig()"]');
    let oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...'; btn.disabled = true;

    try {
        const { error } = await supabase.from('tournaments')
            .upsert({ id: -1, name: 'CONFIG', contract: 'CONFIG', data: newData });

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('configModal')).hide();
        
        // Tải lại dữ liệu ngay lập tức để thấy thay đổi
        await loadFromCloud(false);
        showToast("Configuration saved successfully!", "success");

    } catch (e) {
        console.error(e);
        showToast("Save failed: " + e.message, "error");
    } finally {
        btn.innerHTML = oldText; btn.disabled = false;
    }
}



    // --- BIẾN TOÀN CỤC ĐỂ LƯU Ô THẾ THÂN ---
    let activeCardClonePlaceholder = null; 

    function toggleCardHighlight(el) {
        // Nếu thẻ đang mở -> Click lại thì đóng
        if (el.classList.contains('active-card')) {
            closeActiveCard();
            return;
        }
        // Nếu có thẻ khác đang mở -> Đóng thẻ đó trước
        if (document.querySelector('.tour-card.active-card')) {
            closeActiveCard();
        }

        // 1. TẠO Ô THẾ THÂN (Placeholder)
        // Lấy chiều cao thực tế của thẻ hiện tại để tạo ô trống y hệt
        activeCardClonePlaceholder = document.createElement('div');
        activeCardClonePlaceholder.className = 'tour-card-placeholder';
        activeCardClonePlaceholder.style.height = el.offsetHeight + 'px'; 
        
        // 2. CHÈN Ô THẾ THÂN VÀO VỊ TRÍ CŨ
        el.parentNode.insertBefore(activeCardClonePlaceholder, el);

        // 3. BIẾN THẺ THẬT THÀNH FIXED (Nổi lên giữa màn hình)
        el.classList.add('active-card');
        
        // 4. HIỆN MÀN HÌNH ĐEN
        const backdrop = document.getElementById('card-backdrop');
        if(backdrop) {
            backdrop.style.display = 'block';
            setTimeout(() => backdrop.classList.add('show'), 10);
        }
        document.body.classList.add('has-active-card');
    }

    function closeActiveCard() {
        const activeEl = document.querySelector('.tour-card.active-card');
        if (!activeEl) return;

        // 1. Bỏ class active (để nó hết fixed)
        activeEl.classList.remove('active-card');

        // 2. Xóa ô thế thân đi
        if (activeCardClonePlaceholder) {
            activeCardClonePlaceholder.remove();
            activeCardClonePlaceholder = null;
        }

        // 3. Ẩn màn hình đen
        const backdrop = document.getElementById('card-backdrop');
        if(backdrop) {
            backdrop.classList.remove('show');
            setTimeout(() => backdrop.style.display = 'none', 300);
        }
        document.body.classList.remove('has-active-card');
    }

        /* --- [V46] SMART REFRESH SYSTEM (Anti-Spam) --- */
    let lastRefreshTime = 0;
    const REFRESH_COOLDOWN = 10000; // 10 giây

    // --- [FIXED FINAL] SMART REFRESH: KHÔNG BAO GIỜ GỌI RELOAD KHI ĐANG CHẠY NGẦM ---
async function handleSmartRefresh(isSilent = false) {
    const now = Date.now();
    if (!isSilent) {
        if (now - lastRefreshTime < REFRESH_COOLDOWN) {
            showToast(`Please wait ${Math.ceil((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000)}s!`, "error");
            return;
        }
    }
    lastRefreshTime = now;

    const icon = document.querySelector('.fa-sync-alt');
    if (!isSilent) {
        if(icon) icon.classList.add('fa-spin');
        showToast("Syncing market data...", "info");
    }

    try {

 // const { data, error } = await supabase.functions.invoke('refresh-volume'); 
// Thay bằng dòng dưới để chỉ tải lại dữ liệu nhẹ nhàng từ DB
const { data, error } = { data: { success: true }, error: null }; 
await loadFromCloud(false);
        
        if (error) throw error;

        if (data && data.success) {
            if (data.updatedItems && Array.isArray(data.updatedItems)) {
                // Cập nhật dữ liệu vào biến bộ nhớ
                data.updatedItems.forEach(newItem => {
                    let localItem = compList.find(c => c.db_id === newItem.id);
                    if (localItem) {
                        if(newItem.data.real_alpha_volume) localItem.real_alpha_volume = newItem.data.real_alpha_volume;
                        if(newItem.data.daily_tx_count) localItem.daily_tx_count = newItem.data.daily_tx_count; // Cập nhật Tx
                        if(newItem.data.real_vol_history) localItem.real_vol_history = newItem.data.real_vol_history;
                        if(newItem.data.last_updated_ts) localItem.last_updated_ts = newItem.data.last_updated_ts;
                        if(newItem.data.market_analysis) localItem.market_analysis = newItem.data.market_analysis;
                    }
                });

                // CHỈ CẬP NHẬT SỐ - KHÔNG VẼ LẠI GIAO DIỆN CHÍNH
                updateGridValuesOnly();      
                renderMarketHealthTable();   
                renderStats();               
                
                if (!isSilent) showToast(`Market Data Updated!`, "success");
            } else {
                // Nếu server trả về success nhưng không có data thay đổi
                // Nếu là Silent Mode -> TUYỆT ĐỐI KHÔNG RELOAD -> GIỮ ĐỒNG HỒ ĐỨNG IM
                if (!isSilent) await loadFromCloud(false); 
            }
        }
    } catch (e) {
        console.error(e);
        // Nếu lỗi khi chạy ngầm -> IM LẶNG LUÔN (Không reload, không thông báo)
        if (!isSilent) showToast("Sync Error: " + e.message, "error");
    } finally {
        if(icon) icon.classList.remove('fa-spin');
    }
}

    // --- HÀM FIX: CẬP NHẬT GIÁ (PHIÊN BẢN MỚI: KHÔNG GỌI DEXSCREENER) ---
// Hàm này cần tồn tại để loadFromCloud không bị báo lỗi ReferenceError
function updateAllPrices() {
    console.log("⚠️ Đã chặn DexScreener.");
    
    // Chỉ vẽ lại giao diện để đảm bảo thống nhất dữ liệu
    renderGrid();
    renderStats();
}


            /* --- HÀM VẼ BIỂU ĐỒ V49 (REVERT: TOTAL VOL + MIN TARGET) --- */
    let volHistChart = null;

    function openVolHistory(dbId) {
        let c = compList.find(x => x.db_id == dbId);
        if(!c) return;

        document.getElementById('vh-title').innerText = c.name + " ANALYTICS";
        document.getElementById('vh-subtitle').innerText = "Correlation: Total Vol vs Min Target";

        // 1. LẤY DỮ LIỆU
        let realHistory = c.real_vol_history || [];
        let minHistory = c.history || [];

        let allDates = new Set([
            ...realHistory.map(x => x.date),
            ...minHistory.map(x => x.date)
        ]);

        let isRunning = true;
        if(c.end) {
            let todayStr = new Date().toISOString().split('T')[0];
            if (todayStr > c.end) isRunning = false;
        }

        if (allDates.size === 0 && isRunning) {
            allDates.add(new Date().toISOString().split('T')[0]);
        }

        let sortedDates = Array.from(allDates).sort((a,b) => new Date(a) - new Date(b));

        // --- LỌC BỎ NGÀY SAU KHI KẾT THÚC ---
        if (c.end) {
            sortedDates = sortedDates.filter(d => d <= c.end);
        }


        // Lấy 10 ngày gần nhất
        let recentDates = sortedDates.slice(-10);

        let labels = [];
        let dataReal = [];
        let dataMin = [];
        
        // Lấy ngày hiện tại (YYYY-MM-DD) để so sánh
        let todayStr = new Date().toISOString().split('T')[0];

        recentDates.forEach(date => {
            let parts = date.split('-');
            labels.push(`${parts[2]}/${parts[1]}`);

            // 1. XỬ LÝ TOTAL VOL (CỘT) - VẼ BÌNH THƯỜNG
            let rItem = realHistory.find(x => x.date === date);
            let rVal = rItem ? rItem.vol : 0;
            
            // Nếu là hôm nay mà chưa có trong history thì lấy số Real-time
            if (!rItem && date === todayStr && isRunning) {
                rVal = c.real_alpha_volume || 0;
            }
            dataReal.push(rVal);

            // 2. XỬ LÝ MIN TARGET (ĐƯỜNG) - CẮT NẾU LÀ HÔM NAY
            let mItem = minHistory.find(x => x.date === date);
            let mVal = mItem ? parseFloat(mItem.target) : 0;

            // LOGIC MỚI: 
            // Nếu là ngày hôm nay (date === todayStr) VÀ Giá trị = 0 (Binance chưa cập nhật)
            // Thì đẩy vào 'null'. ChartJS sẽ tự động ngắt nét vẽ tại điểm này.
            if (date === todayStr && mVal === 0) {
                dataMin.push(null); 
            } else {
                dataMin.push(mVal);
            }
        });

        // 3. VẼ CHART
        new bootstrap.Modal(document.getElementById('volHistoryModal')).show();

        const ctx = document.getElementById('volHistoryChart').getContext('2d');
        if (volHistChart) volHistChart.destroy();

        // Màu Gradient Cyberpunk
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 240, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(0, 240, 255, 0.05)');

        volHistChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Vol',
                        data: dataReal,
                        type: 'bar',
                        backgroundColor: gradient,
                        borderColor: '#00F0FF',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.5,
                        order: 2,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Min Target',
                        data: dataMin,
                        type: 'line',
                        borderColor: '#F0B90B', // Vàng
                        backgroundColor: '#F0B90B',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#000',
                        pointBorderColor: '#F0B90B',
                        tension: 0.3,
                        order: 1,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#848e9c', font: { family: 'Rajdhani', size: 11, weight: 'bold' } } },
                    y: {
                        type: 'linear', display: true, position: 'left',
                        grid: { color: '#2b3139', borderDash: [4, 4] },
                        ticks: { color: '#00F0FF', font: { family: 'Rajdhani', size: 10 }, callback: function(v) { return v>=1000000?(v/1000000).toFixed(1)+'M':(v>=1000?(v/1000).toFixed(0)+'k':v); } }
                    },
                    y1: {
                        type: 'linear', display: true, position: 'right', grid: { display: false },
                        ticks: { color: '#F0B90B', font: { family: 'Rajdhani', size: 10, weight: 'bold' }, callback: function(v) { return v>=1000000?(v/1000000).toFixed(1)+'M':(v>=1000?(v/1000).toFixed(0)+'k':v); } }
                    }
                },
                plugins: {
                    legend: { display: true, labels: { color: '#fff', font: { size: 10 }, boxWidth: 10 } },
                    tooltip: {
                        backgroundColor: 'rgba(22, 26, 30, 0.95)', titleColor: '#fff', bodyColor: '#fff', borderColor: '#333', borderWidth: 1, padding: 10,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                let val = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(context.raw);
                                return ` ${label}: $${val}`;
                            }
                        }
                    }
                }
            }
        });
    }



    // --- [V59 FINAL] RENDER GRID: UTC TIME STANDARD ---
function renderGrid(customData = null) {
const SHOW_PREDICT_BTN = false;
    if (document.querySelector('.tour-card.active-card')) {
            updateGridValuesOnly(); // Chỉ update số (Vol, Price...)
            if(typeof renderMarketHealthTable === 'function') renderMarketHealthTable(); // Update bảng Health
            return; // DỪNG HÀM NGAY LẬP TỨC
        }

    const grid = document.getElementById('appGrid');
    if(!grid) return;
    
    // --- [SỬA ĐOẠN NÀY] ---
    let listToRender = customData;

    // Nếu không có customData (không phải đang lọc theo ngày), thì lấy theo Tab
    if (!listToRender) {
        if (appData.gridTab === 'history') {
            listToRender = appData.history;
        } else {
            // Mặc định là Running
            listToRender = appData.running;
        }
    }
    // ----------------------

    listToRender.sort((a,b) => {
        let posA = (a.orderIndex !== undefined && a.orderIndex !== null) ? a.orderIndex : 9999;
        let posB = (b.orderIndex !== undefined && b.orderIndex !== null) ? b.orderIndex : 9999;
        return posA - posB;
    });

    if(listToRender.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center py-5 opacity-50"><i class="fas fa-calendar-times fa-3x mb-3 text-sub"></i><h5 class="text-sub font-num">NO DATA FOUND</h5><button class="btn btn-sm btn-outline-secondary mt-2 rounded-pill px-4" onclick="filterByDate(null)">Show All</button></div>`;
        return;
    }

    const isAdmin = document.body.classList.contains('is-admin');
    document.querySelectorAll('.btn-save-pos').forEach(btn => btn.style.display = isAdmin ? 'block' : 'none');

    
let fullHtml = '';
    let now = new Date();

    listToRender.forEach(c => {
        try {
            // --- [FIX UPCOMING] LOGIC TRẠNG THÁI 3 GIAI ĐOẠN ---
            // 1. Xác định thời điểm BẮT ĐẦU (UTC)
            // Nếu chưa nhập giờ bắt đầu, mặc định là 00:00:00
            let sTimeStr = c.startTime || "00:00:00";
            if(sTimeStr.length === 5) sTimeStr += ":00"; // Thêm giây nếu thiếu
            let startDateTime = new Date(c.start + 'T' + sTimeStr + 'Z');

            // 2. Xác định thời điểm KẾT THÚC (UTC)
            let eTimeStr = c.endTime || "23:59:59";
            if(eTimeStr.length === 5) eTimeStr += ":00";
            let endDateTime = new Date(c.end + 'T' + eTimeStr + 'Z');

            // 3. Phân loại trạng thái (Upcoming / Running / Ended)
            let status = 'running'; // Mặc định
            
            if (now < startDateTime) {
                status = 'upcoming'; // Chưa đến giờ
            } else if (now > endDateTime) {
                status = 'ended';    // Đã qua giờ
            }

            // 4. Tạo class CSS cho thẻ bài
            let cardClass = 'tour-card';
            if (status === 'ended') cardClass += ' ended-card';
            if (status === 'upcoming') cardClass += ' upcoming-card'; // Thêm class này để sau này CSS nếu cần

            // --- XỬ LÝ ĐỒNG HỒ ĐẾM NGƯỢC (BÊN TRÁI) ---
            let tourTimerHtml = '';
            
            if (status === 'upcoming') {
                // Đếm ngược đến giờ BẮT ĐẦU
                let diff = startDateTime - now;
                let d = Math.floor(diff / 86400000);
                let h = Math.floor((diff % 86400000) / 3600000);
                let m = Math.floor((diff % 3600000) / 60000);
                
                // Nếu > 0 ngày thì hiện ngày + giờ, ngược lại hiện giờ + phút
                let tText = d > 0 ? `Starts in ${d}d ${h}h` : `Starts in ${h}h ${m}m`;
                
                // Màu vàng cam cho trạng thái sắp diễn ra
                tourTimerHtml = `<div class="tour-end-timer" style="color:#FFD700"><i class="fas fa-hourglass-start" style="font-size:0.6rem"></i> ${tText}</div>`;
            
            } else if (status === 'running') {
                // Đếm ngược đến giờ KẾT THÚC (Logic cũ)
                let diff = endDateTime - now;
                let d = Math.floor(diff / 86400000);
                let h = Math.floor((diff % 86400000) / 3600000);
                let m = Math.floor((diff % 3600000) / 60000);
                
                let tText = "Ended";
                if (diff > 0) {
                     tText = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
                }
                
                let tColor = (diff < 86400000) ? '#F6465D' : '#999'; 
                tourTimerHtml = `<div class="tour-end-timer" style="color:${tColor}"><i class="far fa-clock" style="font-size:0.6rem"></i> ${tText}</div>`;
            } else {
                // Đã kết thúc
                tourTimerHtml = `<div class="tour-end-timer" style="color:#999"><i class="fas fa-check-circle" style="font-size:0.6rem"></i> Ended</div>`;
            }

            // --- XỬ LÝ NHÃN TRẠNG THÁI (Góc trên thẻ bài) ---
            let statusBadgeHtml = '';
            if (status === 'upcoming') {
                statusBadgeHtml = `<div class="token-status anim-breathe" style="color:#FFD700; border-color:#FFD700">UPCOMING</div>`;
            } else if (status === 'running') {
                statusBadgeHtml = `<div class="token-status anim-breathe text-green">RUNNING</div>`;
            } else {
                statusBadgeHtml = `<div class="token-status text-red">ENDED</div>`;
            }


            // --- [NEW] TẠO LINK BOT ---
        // Thay 'WaveAlphaBot' bằng username bot thật của bạn (không có @)
        // Ví dụ: https://t.me/WaveAlphaBot?start=check_BTC
        const botLink = `https://t.me/WaveAlphaSignal_bot?start=check_${c.name}`;
            

            // --- 2. ĐỒNG HỒ KHUYẾN MÃI X4/X2 (BÊN PHẢI) ---
            let promoTimerHtml = '';
            let isListingExpired = false;

            if (c.listingTime && c.alphaType !== 'none') {
                // Listing Time trong DB thường lưu dạng "YYYY-MM-DDTHH:mm" (Local input)
                // Ta cũng nên thêm 'Z' nếu muốn chuẩn UTC, hoặc để tự nhiên nếu muốn tính theo giờ máy admin.
                // Tốt nhất là chuẩn hóa UTC luôn:
                let listingDate = new Date(c.listingTime + 'Z'); 
                // Nếu input datetime-local không có giây, + 'Z' vẫn chạy tốt.
                
                // Fallback nếu ngày bị lỗi (do input cũ không đúng chuẩn)
                if(isNaN(listingDate.getTime())) listingDate = new Date(c.listingTime);

                let expiryDate = new Date(listingDate.getTime() + (30 * 24 * 60 * 60 * 1000)); 
                let diff = expiryDate - now;

                if (diff > 0) {
                    let d = Math.floor(diff / (1000 * 60 * 60 * 24));
                    let h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    promoTimerHtml = `<div class="promo-timer" title="Promo expires in"><i class="fas fa-bolt" style="font-size:0.6rem"></i> ${d}d ${h}h</div>`;
                } else {
                    isListingExpired = true; 
                }
            }
            
            if (status === 'ended') isListingExpired = true;

            // TAGS & RULES
            let tagHtml = '';
            if (!isListingExpired) {
                if (c.alphaType === 'x4') tagHtml = `<div class="tag-x4">X4 BSC</div>`;
                else if (c.alphaType === 'x2') { cardClass += ' highlight-x2'; tagHtml = `<div class="tag-x2">X2 OTHER</div>`; }
            } else { 
                tagHtml = `<div class="${c.alphaType==='x4'?'tag-x4':'tag-x2'} tag-expired">${c.alphaType==='x4'?'X4 BSC':'X2 OTHER'}</div>`; 
                promoTimerHtml = ''; 
            }
            
            if ((c.inputTokens||[]).length > 0) tagHtml = `<div class="tag-x2" style="background:#9945FF; color:#fff; border:none; box-shadow:0 0 5px #9945FF">ECOSYSTEM</div>`;
            if (c.alphaType === 'x4' && !isListingExpired && !(c.inputTokens||[]).length && status === 'running') cardClass += ' highlight-x4';

            // --- LOGIC HIỂN THỊ TAG (ĐÃ SỬA THÀNH ALL VOL) ---
            let ruleHtml = '';

            if (c.ruleType === 'trade_x4') {
                // Trường hợp x4 (Màu tím)
                ruleHtml = `<div class="rule-pill rp-x4"><i class="fas fa-bolt text-gold" style="font-size:0.55rem"></i> ALL VOL <span class="x4-box">x4</span></div>`;
            } 
            else if (c.ruleType === 'trade_all') {
                // Trường hợp All Vol thường (Màu xanh dương - MỚI)
                // Dùng icon fa-exchange-alt biểu tượng cho 2 chiều mua/bán
                ruleHtml = `<div class="rule-pill rp-all"><i class="fas fa-exchange-alt" style="font-size:0.55rem"></i> ALL VOL</div>`;
            } 
            else {
                // Mặc định là Only Buy (Màu xanh lá)
                ruleHtml = `<div class="rule-pill rp-buy"><i class="fas fa-arrow-up" style="font-size:0.55rem"></i> ONLY BUY</div>`;
            }

            // Giữ nguyên logic làm mờ khi giải kết thúc
            if(status === 'ended') ruleHtml = ruleHtml.replace('rule-pill', 'rule-pill opacity-50 grayscale');

            
            let adminEditBtn = isAdmin ? `<i class="fas fa-pencil-alt ms-2 text-sub cursor-pointer hover-white" style="font-size:0.7rem" onclick="openEditModal('${c.db_id}')"></i>` : '';
            let dragAttr = (isAdmin) ? `draggable="true" ondragstart="drag(event)" ondrop="drop(event)" ondragover="allowDrop(event)"` : '';
            let dragHandleHtml = (isAdmin) ? `<i class="fas fa-grip-vertical admin-drag-handle" title="Kéo để sắp xếp"></i>` : '';
            let isPerfect = (c.market_analysis?.label && c.market_analysis.label.includes("PERFECT"));
            let rocketBadgeHtml = isPerfect ? `<div class="rocket-badge"><i class="fas fa-rocket"></i> GEM</div>` : "";
            if(isPerfect) cardClass += " card-perfect";

            // Các chỉ số
            // Nếu chưa bắt đầu (upcoming) thì Vol = 0, ngược lại lấy Vol thật
let realVol = (status === 'upcoming') ? 0 : (c.real_alpha_volume || 0);
            let realVolDisplay = realVol > 0 ? '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(realVol) : '---';
            let realVolColor = realVol > 0 ? '#d0aaff' : '#666';
            // --- [FIX FINAL] LOGIC LẤY TARGET CHUẨN (CHỐT SỔ NGÀY CUỐI) ---
            let target = 0;
            let rawHist = c.history || [];

            // 1. Sắp xếp lịch sử theo ngày (Mới nhất lên đầu để dễ tìm)
            // Copy ra mảng mới để không ảnh hưởng dữ liệu gốc
            let sortedHist = [...rawHist].sort((a,b) => new Date(b.date) - new Date(a.date));

            if (status === 'ended' && c.end) {
                // A. GIẢI ĐÃ KẾT THÚC:
                // Tìm chính xác record của ngày kết thúc (Ví dụ: NIGHT End 25/12 -> Tìm record 25/12)
                let endRecord = sortedHist.find(h => h.date === c.end);
                
                if (endRecord && parseFloat(endRecord.target) > 0) {
                    target = parseFloat(endRecord.target); // Lấy đúng số 338,588
                } else {
                    // Fallback: Nếu ngày End chưa có số liệu, tìm ngày gần nhất trong quá khứ có số > 0
                    // (Để tránh hiện số 0 hoặc NaN khi admin chưa kịp nhập ngày cuối)
                    let validItem = sortedHist.find(h => h.date <= c.end && parseFloat(h.target) > 0);
                    if (validItem) {
                        target = parseFloat(validItem.target);
                    }
                }
            } else {
                // B. GIẢI ĐANG CHẠY:
                // Luôn lấy target của ngày mới nhất đang có
                if (sortedHist.length > 0) {
                    target = parseFloat(sortedHist[0].target);
                }
            }
            
            // Chống lỗi hiển thị
            if (isNaN(target)) target = 0;
            // -----------------------------------------------------------
            
let usePrice = (c.market_analysis && c.market_analysis.price) ? parseFloat(c.market_analysis.price) : 0;

let priceStr = (usePrice > 0) ? '$' + usePrice.toLocaleString('en-US', { maximumFractionDigits: usePrice < 1 ? 6 : 2 }) : '---';
let estVal = (parseFloat(c.rewardQty)||0) * usePrice;

           
// ... (giữ nguyên dòng estHtml cũ) ...
let estHtml = estVal > 0 ? `<span class="text-green small fw-bold ms-1 anim-breathe live-est-val" data-qty="${c.rewardQty}">~$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(estVal)}</span>` : '<span class="live-est-val" data-qty="'+(c.rewardQty||0)+'"></span>';

// --- [SỬA LẠI] LOGIC LẤY ẢNH THÔNG MINH (CẮT BỎ P1, P2...) ---
let rawName = c.name ? c.name.toUpperCase().trim() : "UNKNOWN";
let cleanSymbol = rawName.split('(')[0].trim();
let localImgPath = `./assets/tokens/${cleanSymbol}.png`;
let defaultImgPath = `./assets/tokens/default.png`; 
// -----------------------------------------------------------

// HTML
fullHtml += `
<div class="col-md-6 col-lg-4 col-xl-3 card-wrapper" ${dragAttr} data-id="${c.db_id}">
    <div class="${cardClass}" onclick="playSfx('click'); toggleCardHighlight(this)">
        <div class="card-head">
            ${rocketBadgeHtml}
            <div class="token-info-wrapper">
                ${dragHandleHtml}
                <img src="${localImgPath}" 
                     onerror="this.onerror=null; this.src='${defaultImgPath}';" 
                     class="token-logo" 
                     onclick="event.stopPropagation(); window.open('https://www.binance.com/en/alpha/${c.chain}/${c.contract}', '_blank')">
                
                <div class="token-text">

                                <div class="token-title d-flex align-items-center">
                                    ${c.name}
                                    <a href="${botLink}" target="_blank" onclick="event.stopPropagation()" 
                                       title="Check on Telegram" 
                                       style="margin-left:8px; color:#2AABEE; font-size:0.85rem; transition:0.2s;" 
                                       onmouseover="this.style.transform='scale(1.2)'" 
                                       onmouseout="this.style.transform='scale(1)'">
                                        <i class="fas fa-robot"></i>
                                    </a>
                                </div>
                                ${statusBadgeHtml}
                                ${tourTimerHtml}
                            </div>
                        </div>
                        <div class="card-head-right">
                            ${ruleHtml}
                            ${tagHtml}
                            ${promoTimerHtml}
                        </div>
                    </div>
                    <div class="card-stats-grid">
                        <div class="stat-cell"><div class="stat-lbl">TOP</div><div class="stat-val text-main">${c.topWinners||'--'}</div></div>
                        <div class="stat-cell border-start border-end border-secondary border-opacity-25"><div class="stat-lbl">REWARD</div><div class="stat-val text-brand">${fmtNum(c.rewardQty)}${estHtml}</div></div>
                        <div class="stat-cell"><div class="stat-lbl">PRICE</div><div class="stat-val text-brand fw-bold font-num live-price-val" data-id="${c.db_id}" style="font-size: 1rem; letter-spacing: 0.5px;">${priceStr}</div></div>
                    </div>
                    <div class="card-list" style="padding: 10px 15px 0 15px;">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="text-sub fw-bold" style="font-size:0.6rem; letter-spacing:1px; text-transform:uppercase;">MY PROGRESS</span>
                            <button class="btn btn-sm fw-bold d-flex align-items-center gap-1" onclick="event.stopPropagation(); openUpdateModal('${c.db_id}')" style="font-size:0.65rem; transition:0.2s; background: rgba(14, 203, 129, 0.15); color: #0ECB81; border: 1px solid #0ECB81; padding: 2px 8px; border-radius: 4px;">
                                <i class="fas fa-pen-to-square"></i> UPDATE VOL
                            </button>
                        </div>
                        <div class="mini-chart-wrapper" onclick="event.stopPropagation()">
                            <canvas id="miniChart-${c.db_id}"></canvas>
                        </div>
                        <div class="acc-stats-grid" id="accGrid-${c.db_id}"></div>
                    </div>
                    <div class="market-bar">
                        <div class="mb-item text-start">
                            <div class="mb-label">Daily Vol <i class="fas fa-info-circle opacity-50" title="Volume Hôm Nay"></i></div>
                            <div class="mb-val" id="live-vol-${c.db_id}" style="color:${realVolColor}">${realVolDisplay}</div>
                        </div>
                        <div class="mb-item text-end">
    <div class="mb-label" style="justify-content: flex-end; color:#F0B90B">Min Target (Goal)</div>
    
    <div class="mb-val text-gold anim-breathe" style="align-items: center; justify-content: flex-end;">
        <span style="font-size: 1.4rem !important; font-weight: 900 !important; color: #ffca28 !important; line-height: 1; display: inline-block; text-shadow: 0 0 15px rgba(240, 185, 11, 0.5);">
            $${fmtNum(target)}
        </span>
        ${adminEditBtn}
    </div>
</div>
                        </div>
                    </div>


${SHOW_PREDICT_BTN ? `
                    <div class="card-actions" style="padding: 0; border:none;">
                        <button class="btn-card-action predict" onclick="event.stopPropagation(); openPredictionView('${c.db_id}')">
                            <i class="fas fa-bolt me-2"></i> ${translations[currentLang].btn_predict}
                        </button>
                    </div>
                    ` : ''}

                    
                </div>
            </div>`;
        } catch(e) { console.error("Render error", e); }
    });

    grid.innerHTML = fullHtml;
    listToRender.forEach(c => { renderCardMiniChart(c); });
    
    // --- GỌI HÀM TOOLTIP MỚI Ở ĐÂY ---
    initSmartTooltips();
}




// --- [FIX V65] UPDATE GRID VALUES (REALTIME VOL & PRICE) ---
function updateGridValuesOnly() {
    try {
        // 1. Cập nhật bảng Market Health (Nếu đang mở)
        if (typeof updateHealthTableRealtime === 'function') {
            updateHealthTableRealtime();
        }

        let maxRewardVal = 0;
        let topToken = null;
        let totalEstPool = 0;

        // 2. Duyệt qua từng Token để cập nhật thẻ bài
        compList.forEach(c => {
            // Logic tính toán Pool tổng
            let isRunning = !c.end || new Date() < new Date(c.end + 'T' + (c.endTime || '23:59') + 'Z');
            
            // Lấy giá mới nhất (Ưu tiên từ Market Analysis nếu có)
            let currentPrice = (c.market_analysis && c.market_analysis.price) ? c.market_analysis.price : (c.cachedPrice || 0);
            if (currentPrice > 0) c.cachedPrice = currentPrice;

            let qty = parseFloat(c.rewardQty) || 0;
            let currentTotalVal = qty * currentPrice;

            if (isRunning) {
                totalEstPool += currentTotalVal;
                if (currentTotalVal > maxRewardVal) {
                    maxRewardVal = currentTotalVal;
                    topToken = c;
                }
            }

            // --- TÌM THẺ BÀI CỦA TOKEN NÀY ---
            const cardWrapper = document.querySelector(`.card-wrapper[data-id="${c.db_id}"]`);
            
            if (cardWrapper) {
                // A. [FIX] CẬP NHẬT VOL (REALTIME)
                // Tìm phần tử hiển thị Vol
const volEl = cardWrapper.querySelector('.market-bar .mb-item:first-child .mb-val');

if (volEl) {
    // Ưu tiên hiển thị Tổng Tích Lũy, nếu không có thì dùng Vol Ngày
    let rv = c.real_alpha_volume || 0;
    
    let rvStr = rv > 0 ? '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(rv) : '---';
    
    if(volEl.innerText !== rvStr) {
        volEl.innerText = rvStr;
        // Hiệu ứng nháy
        volEl.style.color = '#fff';
        volEl.style.textShadow = '0 0 5px #fff';
        setTimeout(() => { 
            volEl.style.color = ''; 
            volEl.style.textShadow = ''; 
        }, 300);
    }
}

                // B. CẬP NHẬT GIÁ (PRICE)
                const priceEl = cardWrapper.querySelector('.live-price-val');
                if (priceEl && currentPrice > 0) {
                    let pStr = currentPrice < 1 
                        ? '$' + currentPrice.toLocaleString('en-US', { maximumFractionDigits: 6 }) 
                        : '$' + currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    
                    if(priceEl.innerText !== pStr) {
                        priceEl.innerText = pStr;
                        priceEl.classList.add('text-brand'); // Màu xanh neon
                        setTimeout(() => priceEl.classList.remove('text-brand'), 500);
                    }
                }

                // C. CẬP NHẬT GIÁ TRỊ ƯỚC TÍNH (REWARD VALUE)
                const estEl = cardWrapper.querySelector('.live-est-val');
                if (estEl) {
                    let estQty = parseFloat(estEl.getAttribute('data-qty')) || qty;
                    let estTotal = estQty * currentPrice;
                    if (estTotal > 0) {
                        estEl.innerText = '~$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(estTotal);
                    }
                }
            }
        });

        // 3. Cập nhật thanh thống kê (Header Stats)
        const poolEl = document.getElementById('stat-pool');
        if (poolEl) poolEl.innerText = fmt(totalEstPool);

        if (topToken) {
            const topSymbolEl = document.getElementById('stat-top-symbol');
            const topValEl = document.getElementById('stat-top-val');
            const topImgEl = document.getElementById('stat-top-img');
            
            if(topSymbolEl) topSymbolEl.innerText = topToken.name;
            if(topValEl) topValEl.innerText = fmt(maxRewardVal);
            if(topImgEl && topToken.logo) { topImgEl.src = topToken.logo; topImgEl.style.display = 'block'; }
        }

        // 4. Cập nhật số liệu trên Lịch
        if (typeof initCalendar === 'function') initCalendar();

    } catch (e) {
        console.error("Lỗi cập nhật số liệu Realtime:", e);
    }
}
        
// --- TRẠNG THÁI SẮP XẾP (Mặc định: Reward giảm dần) ---
let mhSort = { col: 'reward', dir: 'desc' };

/* ==========================================================
   FIX 1: HÀM SORT NHẬN DIỆN ĐÚNG TAB HIỆN TẠI
   ========================================================== */
window.toggleHealthSort = function(col) {
    // 1. Cập nhật trạng thái sort
    if (mhSort.col === col) {
        mhSort.dir = mhSort.dir === 'desc' ? 'asc' : 'desc';
    } else {
        mhSort.col = col;
        mhSort.dir = 'desc';
    }

    // 2. [FIX] Xác định đang ở Tab nào để lấy đúng dữ liệu
    let currentData = [];
    if (typeof appData !== 'undefined') {
            // [FIX] Kiểm tra cả 'ended' VÀ 'history'
            if (appData.currentTab === 'ended' || appData.currentTab === 'history') { 
                projectsToRender = appData.history;
            } else {
                projectsToRender = appData.running;
            }
        }

    // 3. Render lại với dữ liệu đúng
    renderMarketHealthTable(currentData); 
}

// --- HÀM COPY CONTRACT ---
function copyContract(addr) {
    navigator.clipboard.writeText(addr).then(() => {
        if(typeof showToast === 'function') showToast("Copied: " + addr, "success");
    });
}

/* ==========================================================
   2. RENDER MARKET HEALTH (ĐÃ SỬA LỖI FALLBACK)
   ========================================================== */
function renderMarketHealthTable(dataInput) {
    const table = document.querySelector('.health-table');
    const tbody = document.getElementById('healthTableBody');
    if (!table || !tbody) return;

    // --- SỬA LỖI 2: ƯU TIÊN DỮ LIỆU ĐÚNG TAB ---
    let projectsToRender = dataInput; 

    // Nếu không truyền data đầu vào (do hàm update gọi tự động)
    if (!projectsToRender) {
        if (typeof appData !== 'undefined') {
            // [FIX QUAN TRỌNG] Thêm điều kiện 'history'
            if (appData.currentTab === 'ended' || appData.currentTab === 'history') { 
                projectsToRender = appData.history;
            } else {
                projectsToRender = appData.running;
            }
        } else {
            // Fallback cuối cùng: Nếu chưa có appData, tự lọc từ compList
            // Thay vì lấy tất cả, ta lọc sơ bộ để tránh hiện Ending trong Running
            let all = (typeof compList !== 'undefined' ? compList : []);
            let tab = localStorage.getItem('wave_active_tab') || 'running';
            const todayStr = new Date().toISOString().split('T')[0];
            
            if(tab === 'running') {
                projectsToRender = all.filter(c => !c.end || c.end >= todayStr);
            } else {
                projectsToRender = all.filter(c => c.end && c.end < todayStr);
            }
        }
    }
    // -----------------------------------------------------------

    // Kiểm tra Tab History (để ẩn hiện cột)
    // [FIX] Cập nhật logic kiểm tra History
    let isHistoryTab = (typeof appData !== 'undefined' && (appData.currentTab === 'ended' || appData.currentTab === 'history')) || 
                       (localStorage.getItem('wave_active_tab') === 'ended' || localStorage.getItem('wave_active_tab') === 'history');

    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
    const t = (typeof translations !== 'undefined' && translations[lang]) ? translations[lang] : translations['en'];

    // Update Title
    const healthTitleEl = document.querySelector('[data-i18n="health_title"]');
    if(healthTitleEl) healthTitleEl.innerText = t.health_title;

    // ... (Phần còn lại của hàm giữ nguyên như code cũ của bạn) ...
    // Để cho gọn, tôi sẽ viết tiếp phần logic render bên dưới, bạn dán đè vào là được.
    
    // 2. CẤU HÌNH CỘT
    let cols = [
        { key: 'token',       label: 'TOKEN',       align: 'text-center' },
        { key: 'duration',    label: 'TIME',        align: 'text-center', tooltip: 'tip_time' },
        { key: 'win_pool',    label: 'WIN / POOL',  align: 'text-center', tooltip: 'tip_win_pool' },
        { key: 'price_val',   label: 'VAL / PRICE', align: 'text-center', tooltip: 'tip_price_val' },
        { key: 'rule',        label: 'RULE',        align: 'text-center', tooltip: 'tip_rule' },
        { key: 'daily_vol',   label: 'DAILY VOL',   align: 'text-center', tooltip: 'tip_daily_vol' },
        { key: 'camp_vol',    label: 'TOTAL VOL',   align: 'text-center', tooltip: 'tip_camp_vol' }
    ];

    if (!isHistoryTab) {
         cols.push({ key: 'speed_match', label: 'SPD / MATCH', align: 'text-center', tooltip: 'tip_speed_match' });
        cols.push({ key: 'ord_spr',     label: 'ORD / SPR',   align: 'text-center', tooltip: 'tip_ord_spr' });
        }

    cols.push({ key: 'min_vol', label: 'MIN VOL', align: 'text-center', tooltip: 'tip_min_vol' });
    cols.push({ key: 'target', label: 'PREDICTION', align: 'text-center px-2', tooltip: 'tip_pred_header_body', title_key: 'tip_pred_header_title' });

    // 3. RENDER HEADER
    let thead = table.querySelector('thead');
    if (!thead) { thead = document.createElement('thead'); table.prepend(thead); }
    
    let theadHtml = '<tr>';
    cols.forEach(c => {
        let icon = 'fa-sort';
        let activeClass = '';
        if (typeof mhSort !== 'undefined' && mhSort && mhSort.col === c.key) {
            icon = mhSort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
            activeClass = 'sort-active';
        }
        
        let labelText = t['col_' + c.key] || c.label;
        let tipRaw = c.tooltip ? (t[c.tooltip] || '') : '';
        let labelWithTooltip = labelText;

        if (tipRaw) {
            let safeTip = tipRaw;
            let customTitleKey = c.title_key; 
            let tooltipTitleText = (customTitleKey && t[customTitleKey]) ? t[customTitleKey] : labelText;
            let tooltipContent = `<div class='cyber-tip-content'><div class='cyber-tip-header'><i class='fas fa-info-circle'></i> ${tooltipTitleText}</div><div class='cyber-tip-body'>${safeTip}</div></div>`;
            labelWithTooltip = `<span data-bs-toggle="tooltip" data-bs-placement="top" data-bs-html="true" data-bs-custom-class="custom-cyber-tooltip" title="${tooltipContent.replace(/"/g, '&quot;')}" style="cursor:help; border-bottom: 1px dashed rgba(255,255,255,0.2);">${labelText}</span>`;
        }
        theadHtml += `<th class="${c.align}" onclick="toggleHealthSort('${c.key}')" style="cursor:pointer; user-select:none; vertical-align:middle;">${labelWithTooltip} <i class="fas ${icon} sort-icon ${activeClass}"></i></th>`;
    });
    theadHtml += '</tr>';
    thead.innerHTML = theadHtml;

    // 4. SORT DATA
    if (typeof mhSort !== 'undefined' && projectsToRender.length > 0) {
        
        // --- [FIX] NẾU LÀ HISTORY VÀ ĐANG SORT MẶC ĐỊNH -> CHUYỂN SANG SORT NGÀY ---
        if (isHistoryTab && mhSort.col === 'reward') {
            mhSort.col = 'duration';
            mhSort.dir = 'desc'; // Mới nhất lên đầu
        }
        // --------------------------------------------------------------------------

        projectsToRender.sort((a, b) => {
            let pA = (a.market_analysis?.price) || (a.cachedPrice || 0);
            let pB = (b.market_analysis?.price) || (b.cachedPrice || 0);
            const calcCamp = (item) => (item.real_vol_history || []).reduce((acc, i) => acc + parseFloat(i.vol), 0) + (item.real_alpha_volume || 0);
            
            let valA, valB;
            switch(mhSort.col) {
                case 'token':       valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
                case 'daily_vol':   valA = parseFloat(a.real_alpha_volume || 0); valB = parseFloat(b.real_alpha_volume || 0); break;
                case 'camp_vol':    valA = calcCamp(a); valB = calcCamp(b); break;
                
                // --- THÊM CASE SORT THEO NGÀY (DURATION) ---
                case 'duration':    
                    // Nếu là history thì sort theo ngày kết thúc (end), còn lại sort theo ngày bắt đầu (start)
                    valA = new Date(isHistoryTab ? a.end : a.start).getTime();
                    valB = new Date(isHistoryTab ? b.end : b.start).getTime();
                    break;
                // -------------------------------------------

                case 'min_vol':      
                    let getT1 = (item) => {
                        let h = item.history || [];
                        if(h.length === 0) return 0;
                        let dTarget = isHistoryTab ? item.end : new Date(new Date().setDate(new Date().getDate()-1)).toISOString().split('T')[0];
                        let f = h.find(x=>x.date===dTarget);
                        if(!isHistoryTab && !f) { let v = h.filter(x=>x.date!==new Date().toISOString().split('T')[0]); if(v.length>0) f=v[v.length-1]; }
                        return f ? parseFloat(f.target) : 0;
                    };
                    valA = getT1(a); valB = getT1(b);
                    break;
                default:            valA = (parseFloat(a.rewardQty)||0) * pA; valB = (parseFloat(b.rewardQty)||0) * pB;
            }
            if (valA < valB) return mhSort.dir === 'asc' ? -1 : 1;
            if (valA > valB) return mhSort.dir === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // 5. RENDER BODY
    tbody.innerHTML = ''; 
    const fmtNoDec = (num) => !num ? '$0' : '$' + Math.round(num).toLocaleString('en-US');
    const fmtCompact = (num) => !num ? '$0' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 1 }).format(num);
    const formatDateShort = (dateStr) => { if(!dateStr) return '--'; return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    
    const now = new Date(); 
    const yestDate = new Date(); yestDate.setDate(yestDate.getDate() - 1);
    const yestStr = yestDate.toISOString().split('T')[0];
    const dayBeforeDate = new Date(); dayBeforeDate.setDate(dayBeforeDate.getDate() - 2);
    const dayBeforeStr = dayBeforeDate.toISOString().split('T')[0];

    if(projectsToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${cols.length}" class="text-center py-4 text-sub opacity-50">No Data Available</td></tr>`;
        return;
    }

    projectsToRender.forEach(c => {
        if (isHistoryTab && c.name && c.name.toUpperCase().includes('ARB')) return;
        let ma = c.market_analysis || {};
        
        let badgeHtml = '';
        if (c.listingTime) {
            let d = Math.floor((new Date(c.listingTime + (c.listingTime.includes('Z')?'':'Z')).getTime() + (30*86400000) - now)/86400000);
            if (d >= 0) {
                let iconUrl = (c.alphaType === 'x4') ? 'https://i.ibb.co/hRS0Z6wf/1000003428.png' : 'https://i.ibb.co/ZyqMBQp/1000003438.png';
                badgeHtml = `<span class="promo-badge-inline"><img src="${iconUrl}" class="promo-icon-inline"> ${d}d</span>`;
            }
        }
        let contractHtml = c.contract ? `<div class="token-sub-row"><div class="contract-box" onclick="event.stopPropagation(); copyContract('${c.contract}')"><i class="far fa-copy"></i> ${c.contract.slice(0,4)}...${c.contract.slice(-4)}</div></div>` : '';
        let localImgPath = `./assets/tokens/${(c.name||'UNKNOWN').toUpperCase().split('(')[0].trim()}.png`;
        let tokenHtml = `<div class="token-cell-wrapper" style="justify-content:center;display:flex;align-items:center;gap:8px;"><img src="${localImgPath}" onerror="this.src='./assets/tokens/default.png';" style="width:32px;height:32px;border-radius:50%;border:1px solid #333;flex-shrink:0;"><div class="token-info-col" style="text-align:left;"><div class="token-name-row"><span class="token-name-text" style="font-weight:700">${c.name}</span>${badgeHtml}</div>${contractHtml}</div></div>`;

        

// --- [CODE MỚI] LOGIC TRẠNG THÁI UPCOMING CHO TABLE ---
        
        // 1. Xác định thời điểm
        let sTime = c.startTime || "00:00:00"; if(sTime.length===5) sTime+=":00";
        let startDt = new Date(c.start + 'T' + sTime + 'Z');
        
        let eTime = c.endTime || "23:59:59"; if(eTime.length===5) eTime+=":00";
        let endDt = new Date(c.end + 'T' + eTime + 'Z');

        let isUpcoming = now < startDt;
        let isEnded = now > endDt;
        
        // 2. Xử lý cột THỜI GIAN (Duration)
        let countStr = t.txt_ended || 'Ended';
        let timeColor = "text-secondary"; // Mặc định màu xám (Ended)

        if (isUpcoming) {
            // Đếm ngược đến giờ BẮT ĐẦU
            let diff = startDt - now;
            let d = Math.floor(diff/86400000);
            let h = Math.floor((diff%86400000)/3600000);
            let m = Math.floor((diff%3600000)/60000);
            
            let timeText = d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`;
            countStr = `<i class="fas fa-hourglass-start"></i> In ${timeText}`;
            timeColor = "text-gold"; // Màu vàng cho Upcoming
        } 
        else if (!isEnded) {
            // Đếm ngược đến giờ KẾT THÚC (Running)
            let diff = endDt - now;
            if (diff > 0) countStr = `${Math.floor(diff/86400000)}d ${Math.floor((diff%86400000)/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
            timeColor = "text-green"; // Màu xanh cho Running
        } else if (isHistoryTab) {
             countStr = `<span class="text-secondary" style="font-size:0.8rem">Ended: ${formatDateShort(c.end)}</span>`;
        }

        // Đã thêm lại phần hiển thị ngày kết thúc
let durationHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary ${timeColor}" style="font-size:0.8rem; font-weight:bold">${countStr}</span><span class="cell-secondary">${c.start ? formatDateShort(c.start) + ' - ' + formatDateShort(c.end) : '--'}</span></div>`;

        // Các cột tĩnh (Win Pool, Price, Rule)
        let winPoolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white">${c.topWinners ? c.topWinners.replace(/\(p\d+\)/gi, '').trim() : '--'}</span><span class="cell-secondary">${(parseFloat(c.rewardQty)||0).toLocaleString()} ${c.name}</span></div>`;

        let price = ma.price || c.cachedPrice || 0;
        let priceValHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-highlight">${fmtCompact((parseFloat(c.rewardQty)||0) * price)}</span><span class="cell-secondary">$${price.toLocaleString()}</span></div>`;

        let rt = c.ruleType || 'buy_only'; 
        let ruleHtml = `<div class="cell-stack align-items-center justify-content-center"><div class="rule-pill ${rt==='buy_only'?'rp-buy':'rp-all'} ${isHistoryTab?'opacity-50 grayscale':''}">${rt==='trade_x4'?t.rule_buy_sell:(rt==='trade_all'?t.rule_buy_sell:t.rule_buy)}</div><span class="cell-secondary" style="${rt==='trade_x4'?'color:#F0B90B;font-weight:700;opacity:1':'opacity:0'};font-size:0.65rem;margin-top:2px;">${rt==='trade_x4'?t.rule_limit_x4:'&nbsp;'}</span></div>`;

        // 3. Xử lý hiển thị VOLUME (Nếu chưa bắt đầu thì hiện gạch ngang --)
        let dailyVolHtml = '';
        let campVolHtml = '';
        
        if (isUpcoming) {
            // Nếu là Upcoming -> Buộc Volume = -- và hiển thị "UPCOMING"
            dailyVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-sub opacity-50">--</span><span class="cell-secondary text-gold" style="font-size:0.6rem; font-weight:bold">UPCOMING</span></div>`;
            campVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-sub opacity-50">--</span></div>`;
        } else {
            // Logic cũ cho Running/Ended
            let todayVol = c.real_alpha_volume || 0;
            let subDailyVol = '--';
            if (!isHistoryTab && c.real_vol_history) {
                 let yestItem = c.real_vol_history.find(x => x.date === yestStr);
                 if(yestItem) subDailyVol = `Yest: ${fmtNoDec(yestItem.vol)}`;
            }
            dailyVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white">${fmtNoDec(todayVol)}</span><span class="cell-secondary">${subDailyVol}</span></div>`;
            campVolHtml = `<div class="cell-stack justify-content-center"><span id="mh-total-${c.db_id || c.id}" class="cell-primary text-white">${fmtNoDec(c.total_accumulated_volume || 0)}</span></div>`;
        }
        // -----------------------------------------------------------


        let extraCols = '';
        if (!isHistoryTab) {
            let matchSpdHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white">$${Math.round(parseFloat(ma.realTimeVol)||0).toLocaleString()}</span><span class="cell-secondary">${(parseFloat(ma.velocity)||0) > 0 ? ((parseFloat(ma.velocity)||0)/60).toFixed(1)+' ops' : '0 ops'}</span></div>`;
            let ordSprHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-white">$${Math.round(parseFloat(ma.avgTicket)||0).toLocaleString()}</span><span class="cell-secondary ${(parseFloat(ma.spread)||0)>1?'text-red':'text-green'}">${(parseFloat(ma.spread)||0).toFixed(2)}%</span></div>`;
                    extraCols = `<td class="text-center">${matchSpdHtml}</td><td class="text-center font-num">${ordSprHtml}</td>`;
        }

        let h = c.history || [];
        let curTarget = 0, diff = 0, hasData = false;
        let targetDateStr, prevTargetDateStr;

        if (isHistoryTab) {
            targetDateStr = c.end; 
            let d = new Date(c.end); d.setDate(d.getDate() - 1);
            prevTargetDateStr = d.toISOString().split('T')[0];
        } else {
            targetDateStr = yestStr; 
            prevTargetDateStr = dayBeforeStr;
        }

        let latest = h.find(x => x.date === targetDateStr);
        let prev = h.find(x => x.date === prevTargetDateStr);

        if (!isHistoryTab && !latest && h.length > 0) {
            let todayStr = now.toISOString().split('T')[0];
            let validHist = h.filter(x => x.date !== todayStr && x.target > 0).sort((a,b) => new Date(a.date) - new Date(b.date));
            if(validHist.length > 0) {
                latest = validHist[validHist.length - 1];
                if(validHist.length > 1) prev = validHist[validHist.length - 2];
            }
        }

        if (latest) {
            curTarget = parseFloat(latest.target);
            if (prev) {
                diff = curTarget - parseFloat(prev.target);
                hasData = true;
            }
        }

        let diffHtml = `<span class="cell-secondary opacity-50">${t.txt_no_data || '--'}</span>`;
        if (hasData) {
            let pct = (curTarget - diff) > 0 ? ((diff / (curTarget - diff)) * 100).toFixed(1) : 0;
            let color = diff >= 0 ? 'text-green' : 'text-red';
            let sign = diff >= 0 ? '+' : '';
            let diffStr = Math.abs(diff).toLocaleString('en-US');
            diffHtml = `<span class="${color} cell-secondary" style="font-size:0.7rem; font-weight:bold">${sign}${diffStr} (${pct}%)</span>`;
        } else if (curTarget > 0) { 
            diffHtml = `<span class="cell-secondary text-brand" style="font-size:0.6rem; font-weight:bold">${t.txt_new || 'NEW'}</span>`; 
        }

        let minVolHtml = `<div class="cell-stack justify-content-center"><span class="cell-primary text-gold">${fmtNoDec(curTarget)}</span>${diffHtml}</div>`;

        let aiTargetHtml = (typeof calculateAiTarget === 'function') ? calculateAiTarget(c, isHistoryTab) : '<td class="text-center">--</td>';

        tbody.innerHTML += `<tr style="cursor:pointer; border-bottom: 1px solid rgba(255,255,255,0.05);" onclick="jumpToCard('${c.db_id}')">
            <td class="text-center">${tokenHtml}</td>
            <td class="text-center">${durationHtml}</td>
            <td class="text-center">${winPoolHtml}</td>
            <td class="text-center">${priceValHtml}</td>
            <td class="text-center">${ruleHtml}</td>
            <td class="text-center font-num">${dailyVolHtml}</td>
            <td class="text-center font-num">${campVolHtml}</td>
            ${extraCols}
            <td class="text-center font-num">${minVolHtml}</td>
            ${aiTargetHtml}
        </tr>`;
    });
    
    try { var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')); tooltipTriggerList.map(function (el) { return new bootstrap.Tooltip(el); }); } catch(e) {}
}

/* ==========================================================
   FIX UI: 
   1. TÁCH DÒNG DELTA (MARGIN-TOP)
   2. ĐỔI MÀU DELTA SANG BLUE ĐỂ KHÁC BIỆT VỚI MIN VOL
   ========================================================== */
function calculateAiTarget(c, isHistory = false) {
    if (!c) return '<td></td>';

    // 1. Ẩn ARB
    if (c.name && c.name.toUpperCase().includes('ARB')) {
        return '<td class="text-center"><span style="opacity:0.3; font-size:0.8rem">--</span></td>';
    }

    // 2. LẤY DỮ LIỆU
    let prediction = c.ai_prediction || {};
    let target = parseFloat(prediction.target || 0);
    let delta = parseFloat(prediction.delta || 0);

    // 3. XỬ LÝ THỜI GIAN
    let now = new Date();
    let todayStr = now.toLocaleDateString('en-CA'); 
    let isFinalDay = (c.end === todayStr);

    let unlockTime = new Date();
    unlockTime.setUTCHours(5, 0, 0, 0); 
    
    let showPrediction = false;
    if (isHistory) {
        showPrediction = true; 
    } else {
        if (isFinalDay && now >= unlockTime) {
            showPrediction = true;
        }
    }

    // 4. TẠO HTML
    let contentHtml = '';
    let isDisabled = false;
    let tipTitle = "";
    let tipBody = "";

    if (showPrediction && target > 0) {
        isDisabled = false; 
        tipTitle = "AI PREDICTION";
        tipBody = isHistory ? "Final AI result recorded." : "Forecast active.";

        // Delta (Chênh lệch)
        let deltaHtml = '';
        if (delta !== 0) {
            let sign = delta > 0 ? '+' : '';
            // DƯƠNG: Dùng màu xanh Discord (#00FF99)
            // ÂM: Dùng màu đỏ (#ff6b6b)
            let color = delta > 0 ? '#00FF99' : '#ff6b6b'; 
            
            // Tăng margin-top lên 4px để tách dòng
            deltaHtml = `<div style="font-size:0.75em; color:${color}; margin-top:4px; font-weight:600;">(${sign}${delta.toLocaleString('en-US')})</div>`;
        }

        contentHtml = `
    <div style="line-height:1.1; display:flex; flex-direction:column; align-items:center;">
        <span class="text-discord fw-bold" style="font-size:1.1em;">$${Math.round(target).toLocaleString('en-US')}</span>
        ${deltaHtml}
    </div>`;

    } else {
        // --- LOGIC KHI CHƯA CÓ SỐ LIỆU ---
        isDisabled = true;
        
        if (isHistory) {
            contentHtml = '<span style="color:#666; font-size:0.8rem">N/A</span>';
        } else {
            let tPart = (c.endTime || "13:00").trim();
            if(tPart.length === 5) tPart += ":00";
            let endObj = new Date(`${c.end}T${tPart}Z`); 
            let diffMs = endObj - now;

            if (isFinalDay && now < unlockTime) {
                let waitMs = unlockTime - now;
                let h = Math.floor(waitMs / 3600000);
                let m = Math.floor((waitMs % 3600000) / 60000);
                contentHtml = `<div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
                    <span style="font-size:0.8rem; color:#6c757d; font-weight:600;"><i class="fas fa-clock me-1"></i> ${h}h ${m}m</span>
                    <span style="font-size:0.65rem; color:#00f2ea; animation: pulse 1s infinite;">Scanning...</span>
                </div>`;
                tipTitle = "SCANNING";
                tipBody = "Unlocks at 05:00 UTC.";
            } else if (diffMs > 0) {
                let days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                let hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                let timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
                contentHtml = `<span style="font-size:0.8rem; color:#6c757d; font-weight:600;"><i class="fas fa-clock me-1"></i> ${timeStr}</span>`;
                tipTitle = "WAITING";
                tipBody = "Prediction activates on Final Day.";
            } else {
                contentHtml = `<span style="font-size:0.75rem; color:#aaa;">Ended</span>`;
            }
        }
    }

    // 5. VIÊN THUỐC (PILL) UI
    let dbId = c.db_id || c.id || 'uid';
    let stats = (prediction && prediction.stats) ? prediction.stats : {};
    let seed = (typeof dbId === 'string') ? dbId.charCodeAt(0) : 70;
    let pctLow = stats.pct_low !== undefined ? stats.pct_low : ((seed % 15) + 20);
    let pctHigh = stats.pct_high !== undefined ? stats.pct_high : ((seed % 15) + 20);
    let pctMatch = 100 - pctLow - pctHigh;

    let voteKey = `vote_${dbId}`;
    let myVote = localStorage.getItem(voteKey); 
    let activeLow = myVote === 'low' ? 'active' : '';
    let activeMatch = myVote === 'match' ? 'active' : '';
    let activeHigh = myVote === 'high' ? 'active' : '';

    let trackStyle = '';
    let labelStyle = '';
    let tooltipAttr = '';

    if (isHistory) {
        trackStyle = 'style="pointer-events:none; border:none; background:transparent; box-shadow:none; opacity:0.8;"';
        labelStyle = 'style="display:none !important;"';
    } else if (isDisabled) {
        trackStyle = 'style="opacity:0.3; pointer-events:none; filter:grayscale(1);"';
        labelStyle = 'style="opacity:0.3; pointer-events:none; filter:grayscale(1);"';
    }

    if (!isDisabled) {
        let tooltipContent = tipTitle ? `<div class='cyber-tip-content'><div class='cyber-tip-header'><i class='fas fa-robot'></i> ${tipTitle}</div><div class='cyber-tip-body'>${tipBody}</div></div>` : '';
        tooltipAttr = tipTitle ? `data-bs-toggle="tooltip" data-bs-html="true" data-bs-custom-class="custom-cyber-tooltip" title="${tooltipContent.replace(/"/g, '&quot;')}"` : '';
    }

    return `
    <td class="text-center col-ai-target" style="vertical-align: middle;">
        <div class="ai-cell-micro" id="cell-${dbId}">
            <div id="popup-${dbId}" class="popup-micro" onclick="event.stopPropagation()">
                <input type="text" id="inp-${dbId}" class="mic-input" placeholder="Est.?" onkeydown="if(event.key==='Enter') saveMicVote('${dbId}')">
                <button class="mic-btn" onclick="saveMicVote('${dbId}')">OK</button>
            </div>
            
            <div class="ai-pred-val-micro" ${tooltipAttr}>${contentHtml}</div>
            
            <div class="track-micro" ${trackStyle}>
                <div class="seg-micro bg-mic-low ${activeLow}" style="width: ${pctLow}%" id="seg-low-${dbId}" onclick="submitVote('${dbId}', 'low')" title="Lower">
                    <span>${Math.round(pctLow)}%</span> <i class="fas fa-check icon-check"></i>
                </div>
                <div class="seg-micro bg-mic-match ${activeMatch}" style="width: ${pctMatch}%" id="seg-match-${dbId}" onclick="submitVote('${dbId}', 'match')" title="Agree">
                    <span>${Math.round(pctMatch)}%</span> <i class="fas fa-check icon-check"></i>
                </div>
                <div class="seg-micro bg-mic-high ${activeHigh}" style="width: ${pctHigh}%" id="seg-high-${dbId}" onclick="submitVote('${dbId}', 'high')" title="Higher">
                    <span>${Math.round(pctHigh)}%</span> <i class="fas fa-check icon-check"></i>
                </div>
            </div>

            <div class="labels-micro" ${labelStyle}>
                <span class="lbl-text-low" onclick="submitVote('${dbId}', 'low')">Lower</span>
                <span class="lbl-text-match" onclick="submitVote('${dbId}', 'match')">Agree</span>
                <span class="lbl-text-high" onclick="submitVote('${dbId}', 'high')">Higher</span>
            </div>
        </div>
    </td>`;
}

/* ==========================================================
   HÀM XỬ LÝ VOTE (OPTIMISTIC UI + API CALL)
   ========================================================== */
function submitVote(id, type) {
    if(event) event.stopPropagation();

    // --- [FIX START] CHECK LOGIN FIRST ---
    if (!currentUser) {
        showToast("Please login to vote!", "error");
        openLoginModal(); // Automatically open the login modal
        return; // STOP HERE! Do not run the UI animation below
    }

    // 1. OPTIMISTIC UPDATE: Cập nhật giao diện NGAY LẬP TỨC
    // Tắt hết active cũ trong ô này
    const cell = document.getElementById(`cell-${id}`);
    if(cell) {
        cell.querySelectorAll('.seg-micro').forEach(el => el.classList.remove('active'));
    }

    // Bật active cho cái vừa chọn & Hiệu ứng Check
    let segId = (type === 'low') ? `seg-low-${id}` : (type === 'high') ? `seg-high-${id}` : `seg-match-${id}`;
    let activeSeg = document.getElementById(segId);
    
    // Xử lý Popup logic
    if (type === 'match') {
        // Nếu là Agree: Hiển thị check ngay
        if(activeSeg) {
            activeSeg.classList.add('active');
            activeSeg.classList.add('showing-check');
            setTimeout(() => activeSeg.classList.remove('showing-check'), 1500);
        }
        // Đóng popup nếu đang mở
        let popup = document.getElementById(`popup-${id}`);
        if(popup) popup.classList.remove('show');
        
    } else {
        // Nếu là Low/High: Vẫn highlight nút, nhưng hiện Popup để nhập số (tuỳ chọn)
        if(activeSeg) activeSeg.classList.add('active');
        
        // Hiện popup input
        document.querySelectorAll('.popup-micro').forEach(p => p.classList.remove('show')); // Đóng cái khác
        let popup = document.getElementById(`popup-${id}`);
        if(popup) {
            popup.classList.add('show');
            setTimeout(() => {
                let inp = document.getElementById(`inp-${id}`);
                if(inp) inp.focus();
            }, 50);
        }
    }

    // 2. LƯU LOCAL STORAGE (Giữ trạng thái khi F5)
    localStorage.setItem(`vote_${id}`, type);

    // 3. GỌI API BACKEND (Chạy ngầm - Fire & Forget)
    callVoteBackend(id, type, null);
}

/* ==========================================================
   HÀM LƯU TỪ POPUP (KHI USER NHẬP SỐ CHO LOW/HIGH)
   ========================================================== */
function saveMicVote(id) {
    let inp = document.getElementById(`inp-${id}`);
    let val = inp ? inp.value : null;
    
    // Lấy loại vote hiện tại từ storage (vì popup mở ra sau khi bấm nút)
    let type = localStorage.getItem(`vote_${id}`) || 'low'; 
    
    // Gọi API update giá trị ước tính
    callVoteBackend(id, type, val);
    
    // Đóng popup
    let popup = document.getElementById(`popup-${id}`);
    if(popup) popup.classList.remove('show');
    
    // Kích hoạt lại hiệu ứng check để báo thành công
    let segId = (type === 'low') ? `seg-low-${id}` : `seg-high-${id}`;
    let seg = document.getElementById(segId);
    if(seg) {
        seg.classList.add('showing-check');
        setTimeout(() => seg.classList.remove('showing-check'), 1500);
    }
}

/* ==========================================================
   HÀM KẾT NỐI BACKEND (GỌI TRỰC TIẾP TABLE SUPABASE)
   ========================================================== */
async function callVoteBackend(tournamentId, voteType, estVal) {
    // 1. Kiểm tra User
    if (!currentUser) return console.warn("Vote skipped: No user logged in");

    try {
        // 2. Gọi trực tiếp vào bảng 'prediction_votes'
        const { data, error } = await supabase
            .from('prediction_votes')
            .upsert({
                user_id: currentUser.id,
                tournament_id: parseInt(tournamentId),
                vote_type: voteType, // <--- QUAN TRỌNG: Tên cột phải khớp DB
                estimated_value: estVal ? parseFloat(estVal) : null,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'user_id, tournament_id'  // Đảm bảo không trùng lặp
            });

        if (error) throw error;
        console.log("✅ Vote synced to DB:", voteType);

    } catch (e) {
        console.error("❌ Vote Sync Error:", e.message);
        // Nếu lỗi do chưa có quyền (RLS), thông báo nhẹ
        if(e.code === '42501') console.warn("RLS Policy chặn ghi dữ liệu.");
    }
}

             

    /* --- CÁC HÀM XỬ LÝ DRAG & DROP --- */
    let draggedItem = null;
    function allowDrop(ev) { ev.preventDefault(); }

    function drag(ev) {
        draggedItem = ev.currentTarget;
        ev.dataTransfer.effectAllowed = 'move';
        ev.currentTarget.querySelector('.tour-card').classList.add('dragging');
    }

    function drop(ev) {
        ev.preventDefault();
        if(!draggedItem) return;
        draggedItem.querySelector('.tour-card').classList.remove('dragging');
        let targetItem = ev.target.closest('.card-wrapper');
        if (draggedItem !== targetItem && targetItem) {
            let container = document.getElementById('appGrid');
            let dragIdx = [...container.children].indexOf(draggedItem);
            let dropIdx = [...container.children].indexOf(targetItem);
            if (dragIdx < dropIdx) targetItem.after(draggedItem); else targetItem.before(draggedItem);
    showToast("Position changed! Click SAVE POSITION to save.", "info"); // Đã sửa dòng này
}
    }

    async function saveCustomOrder() {
    // Sửa confirm
    if(!confirm("Save current position?")) return;

    let btns = document.querySelectorAll('.btn-save-pos');
    btns.forEach(btn => {
        btn.dataset.oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
        btn.disabled = true;
    });

    try {
        const container = document.getElementById('appGrid');
        const items = container.querySelectorAll('.card-wrapper');
        let updates = [];

        items.forEach((item, index) => {
            let dbId = parseInt(item.getAttribute('data-id'));
            let comp = compList.find(c => c.db_id === dbId);
            if(comp) {
                comp.orderIndex = index;
                updates.push(comp);
            }
        });

        for (let item of updates) {
            let dataToSave = { ...item };
            delete dataToSave.db_id;
            delete dataToSave.id;
            delete dataToSave.cachedPrice;
            dataToSave.history = item.history || [];
            dataToSave.predictions = item.predictions || [];

            await supabase.from('tournaments').update({
                data: dataToSave
            }).eq('id', item.db_id);
        }

        showToast("Position saved successfully!", "success"); // Đã sửa
        await loadFromCloud(false);

    } catch (e) {
        console.error(e);
        showToast("Error saving: " + e.message, "error"); // Đã sửa
    } finally {
        btns.forEach(btn => {
            btn.innerHTML = btn.dataset.oldText || '<i class="fas fa-save me-1"></i> SAVE POSITION';
            btn.disabled = false;
        });
    }
}

    function switchView(view) {
        document.getElementById('view-dashboard').style.display = view==='dashboard'?'block':'none';
        document.getElementById('view-predict').style.display = view==='predict'?'block':'none';
        if(view==='dashboard') { currentPolyId=null; renderGrid(); }
    }

    function switchTab(t) { document.querySelectorAll('.p-tab').forEach(el=>el.classList.remove('active')); document.getElementById(`tab-${t}`).classList.add('active'); ['chart','activity','chat'].forEach(x => document.getElementById(`content-${x}`).style.display = x===t ? (x==='chat'?'flex':'block') : 'none'); }

        
       // --- [FIXED] UPDATE DATA FOR NEW COCKPIT UI ---
// --- [FIXED] UPDATE DATA & BUTTON STATE (ĐỒNG BỘ GIỜ UTC) ---
function updateTerminalData(id) {
    let c = compList.find(x => x.db_id == id); if(!c) return;
    
    // 1. Header Info
    document.getElementById('pt-symbol').innerText = c.name;
    
    // --- [SỬA LẠI] ẢNH LOCAL CHO MỤC PREDICT ---
    let logoEl = document.getElementById('pt-logo');
    
    let rawName = c.name ? c.name.toUpperCase().trim() : "UNKNOWN";
    let cleanSymbol = rawName.split('(')[0].trim(); // Cắt bỏ (P1), (P2)...
    
    let localImgPath = `./assets/tokens/${cleanSymbol}.png`;
    let defaultImgPath = `./assets/tokens/default.png`;

    logoEl.src = localImgPath;
    logoEl.onerror = function() { this.src = defaultImgPath; };
    // -------------------------------------------
    
    // 2. Control Panel Data
    let curMin = (c.history && c.history.length > 0) ? c.history[c.history.length-1].target : 0;
    document.getElementById('pt-min-vol').innerText = fmtNum(curMin);
    
    let totalPool = (c.predictions?.length || 0) * PREDICT_FEE;
    document.getElementById('pt-pool').innerText = fmt(totalPool);

    // 3. LOGIC TIME REMAINING & BUTTON STATE (QUAN TRỌNG)
    let isEnded = false;
    if(c.end) {
        // [FIX] Thêm 'Z' để tính theo giờ UTC chuẩn (Khớp với openInputModal)
        let endString = c.end + 'T' + (c.endTime || '23:59:59') + 'Z';
        let endTime = new Date(endString).getTime();
        
        // Chỉ khi nào thời gian hiện tại VƯỢT QUÁ giờ kết thúc thì mới khóa
        if(Date.now() > endTime) isEnded = true;
    }

    // 4. Update Nút PREDICT
    let btn = document.getElementById('btn-predict-action');
    if(isEnded) {
        btn.innerHTML = '<span>MARKET CLOSED</span> <i class="fas fa-lock"></i>';
        btn.classList.add('btn-ended'); // Thêm class xám màu nếu cần
        btn.disabled = true; // Khóa nút
    } else {
        btn.innerHTML = '<span>ENTER PREDICTION</span> <i class="fas fa-bolt"></i>';
        btn.classList.remove('btn-ended');
        btn.disabled = false; // Mở khóa nút
        btn.onclick = openInputModal; // Gán lại sự kiện click
    }

    // 5. Change Indicator (Giữ nguyên)
    let changeHtml = '';
    if (c.history && c.history.length >= 2) {
        let todayVal = parseFloat(c.history[c.history.length - 1].target);
        let yestVal = parseFloat(c.history[c.history.length - 2].target);
        let diff = todayVal - yestVal;
        let pct = yestVal > 0 ? ((diff / yestVal) * 100).toFixed(2) : 0;
        let color = diff >= 0 ? '#0ECB81' : '#F6465D';
        let icon = diff >= 0 ? 'fa-caret-up' : 'fa-caret-down';
        changeHtml = `<span style="color:${color}; font-size:0.8rem; font-weight:bold"><i class="fas ${icon} me-1"></i>${diff>=0?'+':''}${pct}% (24h)</span>`;
    }
    document.getElementById('pt-vol-change').innerHTML = changeHtml;

    // 6. Vẽ Chart (Giữ nguyên)
    if(!marketChart) {
        let ctx = document.getElementById('marketChart').getContext('2d');
        let labels=[], data=[];
        if(c.history) c.history.forEach(h=>{ labels.push(h.date.substring(5)); data.push(h.target); });
        
        marketChart = new Chart(ctx, { 
             type: 'line', 
             data: { labels, datasets: [{ 
                 label: 'Min Vol', data, borderColor: '#00F0FF', 
                 backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
                    gradient.addColorStop(1, 'rgba(0, 240, 255, 0)');
                    return gradient;
                },
                fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 6 
             }]}, 
             options: { 
                 responsive: true, maintainAspectRatio: false, 
                 interaction: { intersect: false, mode: 'index' },
                 scales: { 
                     x:{ display:true, grid:{display:false}, ticks:{color:'#555', font:{size:9}} }, 
                     y:{ grid:{color:'#222', borderDash:[5,5]}, ticks:{color:'#666', font:{family:'Rajdhani'}} } 
                 }, 
                 plugins:{ legend:{display:false} } 
             } 
         });
    } else {
        let labels=[], data=[];
        if(c.history) c.history.forEach(h=>{ labels.push(h.date.substring(5)); data.push(h.target); });
        marketChart.data.labels = labels;
        marketChart.data.datasets[0].data = data;
        marketChart.update();
    }

    // 7. Leaderboard & Chat (Giữ nguyên logic cũ nhưng trỏ ID mới)
    // --- ĐOẠN CODE DÙNG CHUNG CHO CẢ 2 VỊ TRÍ (Paste đè vào đoạn số 4 và số 7) ---
    let lb = document.getElementById('pt-leaderboard');
        if (lb) { 
            lb.innerHTML = ''; 
            
            // LOGIC SẮP XẾP MỚI: Ưu tiên >= Min, sau đó xếp người gần Min nhất lên đầu
            let preds = (c.predictions || []).sort((a, b) => {
                let aValid = a.guess >= curMin;
                let bValid = b.guess >= curMin;

                // 1. Ai hợp lệ (>= Min) cho lên trên, ai trượt cho xuống dưới
                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;

                // 2. Nếu cùng hợp lệ: Ai nhỏ hơn (gần Min hơn) thì xếp trên
                if (aValid && bValid) {
                    return a.guess - b.guess;
                } 
                // 3. Nếu cùng trượt: Ai lớn hơn (gần Min hơn) thì xếp trên (để vớt vát)
                else {
                    return b.guess - a.guess;
                }
            });
            
            if(preds.length === 0) lb.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-sub opacity-50">No Data</td></tr>';

            preds.forEach((p, i) => {
                // Kiểm tra lại lần nữa để tô màu
                let isValid = p.guess >= curMin;
                
                // Top 1,2,3 màu Vàng/Bạc/Đồng. Còn lại màu xám. Người thua cuộc màu tối hơn.
                let rankColor = isValid 
                    ? (i===0?'#FFD700':(i===1?'#C0C0C0':(i===2?'#CD7F32':'#666'))) 
                    : '#333'; 

                let rankText = isValid ? `#${i + 1}` : '<i class="fas fa-times"></i>'; // Hiện dấu X nếu loại

                let badgeHtml = `<span class="rank-badge" style="background:${rankColor}; color:${isValid && i<3 ? '#000' : '#fff'}; border:1px solid #444">${rankText}</span>`;
                
                let avatarHtml = p.avatar ? `<img src="${p.avatar}" class="list-avatar">` : `<div class="list-avatar-placeholder">${p.name.substring(0, 1).toUpperCase()}</div>`;
                
                // Highlight chính mình
                let myName = document.getElementById('modal-p-name')?.value || '';
                let highlightClass = (p.name === myName) ? 'anim-breathe' : '';
                
                // Làm mờ dòng bị loại (Opacity 0.4)
                let rowStyle = isValid ? '' : 'opacity: 0.4; filter: grayscale(1);';

                lb.innerHTML += `
                <tr class="${highlightClass}" style="${rowStyle}">
                    <td class="ps-4 align-middle">${badgeHtml}</td>
                    <td class="align-middle">
                        <div class="d-flex align-items-center gap-2">
                            ${avatarHtml}
                            <span class="text-white small fw-bold">${p.name}</span>
                        </div>
                    </td>
                    <td class="text-end pe-4 align-middle font-num fw-bold" style="color:${isValid ? 'var(--brand)' : '#666'}">
                        ${fmtNum(p.guess)}
                    </td>
                </tr>`;
            });
        }

    let chatDiv = document.getElementById('chat-feed');
    if(chatDiv) {
        chatDiv.innerHTML = '';
        (c.comments || []).sort((a,b)=>a.time-b.time).forEach(m => {
            let isMe = m.user === (userProfile?.nickname || currentUser?.email.split('@')[0]);
            chatDiv.innerHTML += `<div class="mb-2 d-flex ${isMe?'justify-content-end':''}"><div style="background:${isMe?'var(--brand)':'#222'}; color:${isMe?'#000':'#ddd'}; padding:5px 10px; border-radius:10px; font-size:0.8rem; max-width:85%"><div class="fw-bold" style="font-size:0.65rem; opacity:0.7; margin-bottom:2px">${m.user}</div>${DOMPurify.sanitize(m.text)}</div></div>`;
        });
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }
}

    function openInputModal() {
    // [SAFETY 1] Kiểm tra xem đã chọn giải đấu chưa
    if (!currentPolyId) return showToast("System Error: No Tournament Selected", "error");

    let c = compList.find(x => x.db_id == currentPolyId);
    
    // [SAFETY 2] Quan trọng: Nếu không tìm thấy dữ liệu giải -> Báo lỗi chứ không để Crash
    if (!c) {
        console.error("Data missing for ID: " + currentPolyId);
        return showToast("Data not ready. Please reload page!", "error");
    }

    // --- LOGIC KHÓA CỔNG (Theo giờ chuẩn UTC) ---
    if(c.end) {
        // Thêm 'Z' để máy hiểu là giờ UTC
        let endString = c.end + 'T' + (c.endTime || '23:59:59') + 'Z';
        let endTime = new Date(endString).getTime();
        
        // Chỉ chặn nếu giờ hiện tại ĐÃ VƯỢT QUÁ giờ kết thúc
        if(Date.now() > endTime) {
            return showToast("⛔ Tournament has ENDED! Prediction closed.", "error");
        }
    }
    // ---------------------------------------------

    if(!currentUser) { showToast("Please login to predict!", "error"); return; }
    
    // CHECK BALANCE
    if((userProfile.balance_usdt || 0) < PREDICT_FEE) {
        return showToast(`Insufficient Balance! You need ${PREDICT_FEE} USDT.`, "error");
    }

    let displayName = userProfile?.nickname || currentUser.email.split('@')[0];
    let nameInput = document.getElementById('modal-p-name');
    if(nameInput) {
        nameInput.value = displayName;
        nameInput.disabled = true;
    }
    
    let guessInput = document.getElementById('modal-p-guess');
    if(guessInput) guessInput.placeholder = `Fee: ${PREDICT_FEE} USDT`;

    new bootstrap.Modal(document.getElementById('inputModal')).show();
}

async function submitPredictionFromModal() {
    let nameInput = document.getElementById('modal-p-name');
    let guessInput = document.getElementById('modal-p-guess');
    
    // Validate dữ liệu đầu vào
    let name = nameInput.value.trim();
    let guess = parseFloat(guessInput.value);

    if(!currentUser) return showToast("Please Login to predict!", "error");
    if(!name) return showToast("Nickname required", "error");
    if(isNaN(guess) || guess < 0) return showToast("Invalid Prediction Volume", "error");

    // Hiệu ứng nút bấm
    let btn = document.querySelector('#inputModal .btn-action');
    let oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> PROCESSING...';
    btn.disabled = true;

    try {
        // Gọi RPC Supabase
        const { data, error } = await supabase.rpc('submit_prediction_action', {
            p_tourn_id: parseInt(currentPolyId),
            p_guess: guess,
            p_name: name,
            p_avatar: userProfile?.avatar_url || ''
        });

        if (error) throw error;
        if (data && data.status === 'error') throw new Error(data.message);

        // Update số dư ngay lập tức
        if(data && data.new_balance !== undefined) {
            userProfile.balance_usdt = data.new_balance;
            document.getElementById('user-balance').innerText = fmtNum(data.new_balance);
        }

        showToast(`🚀 ENTRY CONFIRMED! (-${PREDICT_FEE} USDT)`, "success");
        playSfx('click');
        
        // Đóng Modal
        bootstrap.Modal.getInstance(document.getElementById('inputModal')).hide();

        // --- CẬP NHẬT GIAO DIỆN (MƯỢT MÀ) ---
        // 1. Cập nhật lại thanh thống kê Pool bên ngoài
        renderStats();

        // 2. Gọi hàm Reload An Toàn (Đã sửa ở trên)
        if(currentPolyId) await silentReload(currentPolyId);

        // 3. Hiện bảng khoe thành tích (Share Card)
        setTimeout(() => { 
             generateShareCard(guess);
        }, 800);

    } catch (e) {
        console.error(e);
        showToast("Error: " + e.message, "error");
        playSfx('hover');
    } finally {
        // Trả lại trạng thái nút bấm
        if(btn) {
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }
}


    // V45 VIRAL LOOP: GENERATE SHARE CARD
    function generateShareCard(userGuess = null) {
        let c = compList.find(x => x.db_id == currentPolyId);
        if(!c) return;

        // 1. Fill Token Data
        document.getElementById('sc-token-name').innerText = c.name;

        // 2. Fill User Data (V45 Update)
        let uName = userProfile?.nickname || "Trader";
        // Sử dụng UI Avatars nếu user chưa có ảnh (fallback đẹp)
        let uAvatar = userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${uName}&background=random&color=fff&size=128`;

        document.getElementById('sc-user-name').innerText = uName;

        // Handle Avatar Image (CORS Safe)
        let uaEl = document.getElementById('sc-user-avatar');
        uaEl.crossOrigin = "anonymous";
        uaEl.src = uAvatar + (uAvatar.includes('?')?'&':'?') + 't=' + new Date().getTime();
        uaEl.onerror = function(){ this.src = 'https://placehold.co/50/333/fff?text=' + uName.charAt(0); }; // Fail-safe

        // Date Format
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('sc-date-display').innerText = `${dateStr} | ${timeStr}`;

        // --- [ĐÃ SỬA] LOGIC ẢNH LOCAL CHO SHARE CARD ---
        let imgEl = document.getElementById('sc-token-img');
        
        // 1. Làm sạch tên (VD: "STAR (P1)" -> "STAR")
        let rawName = c.name ? c.name.toUpperCase().trim() : "UNKNOWN";
        let cleanSymbol = rawName.split('(')[0].trim();
        
        // 2. Tạo đường dẫn ảnh Local
        let localImgPath = `./assets/tokens/${cleanSymbol}.png`;
        
        // 3. Gán ảnh
        imgEl.crossOrigin = "anonymous"; // Giữ nguyên để html2canvas hoạt động
        imgEl.src = localImgPath;
        
        // 4. Xử lý lỗi (Ẩn đi nếu không tìm thấy ảnh)
        imgEl.onerror = function() { 
            this.style.display = 'none'; 
        };
        imgEl.onload = function() {
            this.style.display = 'block';
        };
        // -------------------------------------------

        let curMin = (c.history && c.history.length>0) ? c.history[c.history.length-1].target : 0;
        document.getElementById('sc-min-vol').innerText = fmtNum(curMin);

        // If userGuess passed, use it. Else try to find from user predictions
        if(!userGuess && currentUser && c.predictions) {
            let myP = c.predictions.find(p => p.user_id === currentUser.id);
            if(myP) userGuess = myP.guess;
        }
        document.getElementById('sc-my-guess').innerText = userGuess ? fmtNum(userGuess) : '---';

        // 2. Generate QR Code
        let qrBox = document.getElementById('sc-qr-target');
        qrBox.innerHTML = '';
        let link = siteConfig.affiliate?.binance || window.location.href;
        new QRCode(qrBox, { text: link, width: 50, height: 50 });

        // 3. Show Modal
        new bootstrap.Modal(document.getElementById('shareCardModal')).show();
    }

    // --- V45 NEW: SMART SOCIAL SHARE WITH IMAGE ---
    async function shareImageSmart(platform) {
        const element = document.getElementById('share-card-container');
        let c = compList.find(x => x.db_id == currentPolyId);
        let guess = document.getElementById('sc-my-guess').innerText;
        let webUrl = "https://wave-alpha.pages.dev";

        let text = "";
        if (platform === 'x') {
            text = `🚀 I predicted $${c.name} Min Volume: ${guess} on Wave Alpha!\n\nCan you beat me? 👇\n${webUrl}\n\n#WaveAlpha #Crypto #Trading`;
        } else {
            text = `🔥 I predict $${c.name} Min Volume: ${guess}!\nJoin Wave Alpha Terminal here: ${webUrl}`;
        }

        try {
            showToast("Generating image...", "info");

            // 1. Capture Image
            const canvas = await html2canvas(element, {
                backgroundColor: '#161a1e', scale: 2, useCORS: true, allowTaint: true, logging: false
            });
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            const file = new File([blob], "WaveAlpha-Prediction.png", { type: "image/png" });

            // 2. Try Native Share (Mobile - Best Experience)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Wave Alpha Prediction',
                    text: text,
                    files: [file]
                });
                showToast("Shared successfully!", "success");
            } else {
                // 3. Fallback: Download + Open Link (Desktop)
                // Browser cannot auto-attach image to X/Tele web, so we download it for user
                const link = document.createElement('a');
                link.download = 'WaveAlpha-Prediction.png';
                link.href = canvas.toDataURL('image/png');
                link.click();

                showToast("Image Saved! Please attach it to your post.", "success");

                setTimeout(() => {
                    let shareUrl = "";
                    if (platform === 'x') {
                        let hashtags = `WaveAlpha,Crypto,${c.name}`;
                        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                    } else {
                        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(webUrl)}&text=${encodeURIComponent(text)}`;
                    }
                    window.open(shareUrl, '_blank');
                }, 1000);
            }

        } catch (e) {
            console.error(e);
            showToast("Share failed: " + e.message, "error");
        }
    }

    // Map old functions to new Smart Logic
    function shareToX() { shareImageSmart('x'); }
    function shareToTele() { shareImageSmart('tele'); }

    function downloadShareCard() {
        let element = document.getElementById('share-card-container');

        // FIX: Cấu hình html2canvas chuẩn để bắt được ảnh và style
        html2canvas(element, {
            backgroundColor: '#161a1e', // Đặt màu nền cứng để tránh trong suốt/mất chữ
            scale: 2, // Tăng độ nét
            useCORS: true, // Quan trọng: Cho phép tải ảnh từ domain khác
            allowTaint: true, // Cho phép "vấy bẩn" canvas (giúp render ảnh khó tính)
            logging: false
        }).then(canvas => {
            let link = document.createElement('a');
            link.download = 'WaveAlpha-Prediction.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    function sendChat() {
        if(!currentUser) return showToast("Please login to chat!", "error");
        let txt = document.getElementById('chat-msg').value;
        if(!txt) return;
        let c = compList.find(x => x.db_id == currentPolyId);
        if(!c.comments) c.comments = [];

        let displayName = userProfile?.nickname || currentUser.email.split('@')[0];
        c.comments.push({
            user: displayName,
            text: txt,
            time: Date.now(),
            avatar: userProfile?.avatar_url || ''
        });

        let obj = {...c}; delete obj.db_id;
        const payload = {
            name: obj.name || c.name,
            contract: obj.contract || c.contract,
            data: obj
        };

        supabase.from('tournaments').update(payload).eq('id', currentPolyId).then(() => {
            loadFromCloud(false);
        });
        document.getElementById('chat-msg').value = '';
    }

    // --- HÀM LƯU DỮ LIỆU LÊN MÂY (CÓ BẮT LỖI CHẶT CHẼ) ---
async function saveToCloud(compObj) {
    // 1. Tạo bản sao dữ liệu sạch
    let cloudObj = { ...compObj };
    
    // Xóa các biến tạm không cần lưu
    delete cloudObj.myProgress; 
    delete cloudObj.db_id; 
    delete cloudObj.id; 
    delete cloudObj.cachedPrice;
    
    // (Tùy chọn) Xóa predictions/comments nếu bạn không muốn ghi đè user data
    // delete cloudObj.predictions; 
    // delete cloudObj.comments;

    const payload = { 
        name: cloudObj.name, 
        contract: cloudObj.contract, 
        data: cloudObj 
    };

    console.log("Saving payload:", payload); // Debug: Xem dữ liệu gửi đi

    let result;
    
    // 2. Thực hiện lệnh Save
    if (compObj.db_id) {
        // Update
        result = await supabase
            .from('tournaments')
            .update(payload)
            .eq('id', parseInt(compObj.db_id))
            .select(); // <--- BẮT BUỘC CÓ .select() để kiểm tra kết quả
    } else {
        // Insert
        result = await supabase
            .from('tournaments')
            .insert([payload])
            .select();
    }

    // 3. KIỂM TRA LỖI RLS (QUAN TRỌNG)
        if (result.error) throw result.error;
    
    if (!result.data || result.data.length === 0) {
        console.error("Save failed (RLS Blocked). Result:", result);
        // Sửa thông báo lỗi này sang tiếng Anh
        throw new Error("ADMIN PERMISSION ERROR! Database refused to save. Check RLS Policies.");
    }

    console.log("Save Success:", result.data);

    // 4. Tải lại dữ liệu để đồng bộ
    await loadFromCloud(false);
}

    // --- MODAL UPDATES (TRACKING & HISTORY) ---
    function openUpdateModal(dbId) {
        let c=compList.find(x=>x.db_id==dbId); if(!c)return;
        document.getElementById('u-db-id').value=dbId; document.getElementById('u-symbol-display').innerText=c.name;
        let today=new Date().toISOString().split('T')[0];
        document.getElementById('u-original-date').value = "";
        document.getElementById('u-date').value=today;

        let min=document.getElementById('u-min-vol');
        if(document.body.classList.contains('is-admin')){ min.disabled=false; min.placeholder="Admin Edit"; } else { min.disabled=true; min.placeholder="---"; }
        let html='';
        accSettings.forEach(acc=>{
            html+=`<div class="acc-input-row" id="row-${acc.id}"><span style="color:${acc.color}; font-weight:700;">${acc.name}</span><input type="number" class="form-control font-num text-center text-brand" id="u-vol-${acc.id}" placeholder="Volume" oninput="calcRowGap('${acc.id}')"><div class="d-flex align-items-center gap-2"><span class="font-num fw-bold text-sub small" id="gap-display-${acc.id}" style="width:70px; text-align:right;">---</span><input type="number" class="form-control font-num text-end text-danger" id="u-cost-${acc.id}" placeholder="Cost ($)" style="max-width:80px"></div></div>`;
        });
        document.getElementById('u-acc-inputs').innerHTML=html; loadDateData(today); document.getElementById('u-date').onchange=function(){loadDateData(this.value)}; new bootstrap.Modal(document.getElementById('updateModal')).show();
    }

    function calcRowGap(accId) {
        let minInput = document.getElementById('u-min-vol').value.replace(/,/g, '');
        let min = parseFloat(minInput) || 0;
        let vol = parseFloat(document.getElementById(`u-vol-${accId}`).value) || 0;
        let gap = vol - min;
        let el = document.getElementById(`gap-display-${accId}`);
        if(min > 0) { el.innerText = (gap>=0 ? '+' : '') + fmtNum(gap); el.className = `font-num fw-bold small ${gap>=0?'text-green':'text-red'}`; } else { el.innerText = '---'; }
    }

    // V43 UPGRADE: USE TRACKER_DATA FROM CLOUD
    function loadDateData(d) {
        let id=document.getElementById('u-db-id').value; let c=compList.find(x=>x.id==id);
        let min=0;
        if(c.history){let e=c.history.find(h=>h.date===d); if(e)min=e.target; else if(c.history.length>0)min=c.history[c.history.length-1].target;}
        let minInput = document.getElementById('u-min-vol');
        minInput.value=fmtNum(min).replace(/\./g, '');
        formatCurrency(minInput);

        accSettings.forEach(acc=>{ document.getElementById(`u-vol-${acc.id}`).value=''; document.getElementById(`u-cost-${acc.id}`).value=''; calcRowGap(acc.id); });

        // GET DATA FROM USER PROFILE INSTEAD OF LOCAL C.MYPROGRESS
        let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[id]) ? userProfile.tracker_data[id] : [];

        if(myProgress){
            let p = myProgress.find(x => x.date === d);
            if(p && p.accsDetail){
                accSettings.forEach(acc=>{
                    if(p.accsDetail[acc.id]){
                        document.getElementById(`u-vol-${acc.id}`).value=p.accsDetail[acc.id].vol;
                        document.getElementById(`u-cost-${acc.id}`).value=p.accsDetail[acc.id].cost;
                        calcRowGap(acc.id);
                    }
                })
            }
        }
        renderTrackerChart(c); renderHistoryList(c);
    }

    function loadHistoryToEdit(date) {
        document.getElementById('u-date').value = date;
        document.getElementById('u-original-date').value = date;
        loadDateData(date);
        document.getElementById('u-date').focus();
    }

    function renderTrackerChart(c) {
        const ctx = document.getElementById('trackerChart').getContext('2d');
        if(trackerChart) trackerChart.destroy();

        let labels=[], minData=[], dates=new Set();
        if(c.history) c.history.forEach(x => dates.add(x.date));

        // GET DATA FROM USER PROFILE
        let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[c.id]) ? userProfile.tracker_data[c.id] : [];
        if(myProgress) myProgress.forEach(x => dates.add(x.date));

        let sortedDates = Array.from(dates).sort();

        minData = sortedDates.map(d => {
            let h = c.history ? c.history.find(x => x.date === d) : null;
            return h ? h.target : 0;
        });

        let datasets = [{
            label: 'Target (Min)',
            data: minData,
            borderColor: '#F0B90B',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0,
            fill: false,
            order: 0
        }];

        accSettings.forEach(acc => {
            let accData = [];
            sortedDates.forEach(d => {
                let p = myProgress ? myProgress.find(x => x.date === d) : null;
                let vol = (p && p.accsDetail && p.accsDetail[acc.id]) ? parseFloat(p.accsDetail[acc.id].vol) : 0;
                accData.push(vol);
            });

            datasets.push({
                label: acc.name,
                data: accData,
                borderColor: acc.color,
                backgroundColor: acc.color,
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: (ctx) => {
                    let idx = ctx.dataIndex;
                    let val = ctx.raw;
                    let target = minData[idx] || 0;
                    return val >= target ? '#0ECB81' : '#F6465D';
                },
                pointBorderColor: '#fff',
            });
        });

        trackerChart = new Chart(ctx, {
            type: 'line',
            data: { labels: sortedDates.map(d => d.substring(5)), datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: '#aaa', boxWidth: 10, font: {size: 10} } },
                    tooltip: {
                        enabled: true, backgroundColor: 'rgba(22, 26, 30, 0.95)', titleColor: '#00F0FF',
                        titleFont: { family: 'Rajdhani', size: 14, weight: 'bold' },
                        bodyColor: '#fff', bodyFont: { family: 'Rajdhani', size: 13 },
                        borderColor: '#333', borderWidth: 1, padding: 10, displayColors: true, boxPadding: 4,
                        callbacks: { label: function(context) { let label = context.dataset.label || ''; if (label) { label += ': '; } if (context.parsed.y !== null) { label += new Intl.NumberFormat('en-US').format(context.parsed.y); } return label; } }
                    }
                },
                scales: { x: { display: true, ticks: { color: '#555', font:{size:9} }, grid: {display:false} }, y: { display: false } }
            }
        });
    }

    // --- [NEW] HÀM VẼ LỊCH SỬ (AUTO-FILL LOGIC) ---
// --- [FINAL V2] HÀM VẼ LỊCH SỬ (FIX LỖI MẤT NGÀY CUỐI) ---
function renderHistoryList(c) {
    // 1. Vẽ tiêu đề bảng
    let headerHtml = `<th class="text-sub small">Date</th><th class="text-gold small">Target</th>`;
    accSettings.forEach(acc => { headerHtml += `<th class="small text-center" style="color:${acc.color}">${acc.name}</th>`; });
    headerHtml += `<th class="text-end small">Action</th>`;
    document.getElementById('historyHeader').innerHTML = headerHtml;

    const l = document.getElementById('historyList');
    l.innerHTML = '';

    // 2. Lấy dữ liệu
    let adminHistory = c.history || [];
    let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[c.id]) ? userProfile.tracker_data[c.id] : [];

    // 3. Xác định Start Date & End Date (Dạng Chuỗi YYYY-MM-DD)
    let startDateStr = c.start;
    // Nếu không có ngày bắt đầu thì tìm ngày cũ nhất
    if (!startDateStr) {
        let allDates = [...adminHistory.map(h=>h.date), ...myProgress.map(p=>p.date)];
        if(allDates.length > 0) startDateStr = allDates.sort()[0];
        else startDateStr = new Date().toISOString().split('T')[0];
    }

    // Lấy ngày hôm nay (Local Time) chuẩn dạng YYYY-MM-DD
    let now = new Date();
    let todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

    // --- [LOGIC QUAN TRỌNG: CHỐT NGÀY DỪNG (CUT-OFF)] ---
    // Mặc định chạy đến hôm nay
    let limitStr = todayStr;

    // Nếu giải có ngày kết thúc (End Date)
    if (c.end) {
        // So sánh chuỗi: Nếu "2025-12-12" < "2025-12-18" (Đã qua ngày kết thúc)
        // Thì chốt sổ tại ngày kết thúc "2025-12-12"
        if (c.end < todayStr) {
            limitStr = c.end;
        }
    }

    // 4. CHẠY VÒNG LẶP (DÙNG DATE OBJECT ĐỂ TĂNG NGÀY)
    let timelineData = [];
    let lastKnownTarget = 0;
    let lastKnownVols = {}; 
    accSettings.forEach(acc => lastKnownVols[acc.id] = 0);

    // Bắt đầu từ ngày start
    let loopDate = new Date(startDateStr);
    // Xử lý múi giờ: Set giờ về 12:00 trưa để tránh việc +/- giờ làm nhảy ngày
    loopDate.setHours(12,0,0,0); 

    // VÒNG LẶP: Chừng nào ngày đang xét (loopStr) <= ngày giới hạn (limitStr) thì còn chạy
    while (true) {
        let dStr = loopDate.toISOString().split('T')[0];
        
        // Nếu ngày đang chạy lớn hơn ngày giới hạn -> DỪNG NGAY
        if (dStr > limitStr) break;

        // A. Admin Target (Kế thừa từ ngày trước nếu thiếu)
        let realAdminData = adminHistory.find(h => h.date === dStr);
        if (realAdminData) lastKnownTarget = parseFloat(realAdminData.target);

        // B. User Volume (Kế thừa từ ngày trước nếu thiếu)
        let realUserData = myProgress.find(p => p.date === dStr);
        let currentDayVols = {};
        
        accSettings.forEach(acc => {
            if (realUserData && realUserData.accsDetail && realUserData.accsDetail[acc.id]) {
                let v = parseFloat(realUserData.accsDetail[acc.id].vol);
                lastKnownVols[acc.id] = v; // Cập nhật số mới
            }
            currentDayVols[acc.id] = lastKnownVols[acc.id]; // Dùng số (mới hoặc cũ)
        });

        let isAutoFill = !realUserData; 

        timelineData.push({
            date: dStr,
            target: lastKnownTarget,
            vols: currentDayVols,
            isAuto: isAutoFill
        });

        // Tăng 1 ngày
        loopDate.setDate(loopDate.getDate() + 1);
    }

    // 5. VẼ RA BẢNG (Đảo ngược để ngày mới nhất lên đầu)
    timelineData.reverse().forEach(item => {
        let dateDisplay = item.date.substring(5); // MM-DD
        let targetDisplay = fmtNum(item.target);
        
        let accCells = '';
        accSettings.forEach(acc => {
            let vol = item.vols[acc.id];
            let cls = vol >= item.target && item.target > 0 ? 'text-green fw-bold' : (vol > 0 ? 'text-white' : 'text-sub opacity-50');
            accCells += `<td class="text-center font-num ${cls}">${vol > 0 ? fmtNum(vol) : '-'}</td>`;
        });

        // Chỉ hiện nút Xóa cho ngày có dữ liệu thực
        let deleteBtn = item.isAuto 
            ? `<i class="fas fa-trash text-secondary opacity-25" style="cursor:not-allowed" title="Auto-filled"></i>` 
            : `<i class="fas fa-trash text-danger cursor-pointer" onclick="deleteHistory('${item.date}')" title="Delete"></i>`;

        l.innerHTML += `<tr>
            <td class="font-num text-sub">${dateDisplay}</td>
            <td class="text-gold font-num fw-bold">${targetDisplay}</td>
            ${accCells}
            <td class="text-end">
                <i class="fas fa-pencil-alt text-secondary me-3 cursor-pointer" onclick="loadHistoryToEdit('${item.date}')" title="Edit"></i>
                ${deleteBtn}
            </td>
        </tr>`;
    });
}

    async function deleteHistory(date) {
        if(!confirm("Delete history for " + date + "?")) return;
        let id = document.getElementById('u-db-id').value;
        let c = compList.find(x => x.id == id);

        // V43: DELETE FROM CLOUD TRACKER DATA
        if(userProfile.tracker_data && userProfile.tracker_data[id]) {
            userProfile.tracker_data[id] = userProfile.tracker_data[id].filter(p => p.date !== date);
            // Save to Cloud immediately
            await supabase.from('profiles').update({ tracker_data: userProfile.tracker_data }).eq('id', currentUser.id);
        }

        if(document.body.classList.contains('is-admin')) {
             if(c.history) {
                 c.history = c.history.filter(h => h.date !== date);
                 await saveToCloud(c);
             }
        } else {
            renderTrackerChart(c);
            renderHistoryList(c);
        }
        if(document.getElementById('u-date').value === date) {
             document.getElementById('u-date').value = new Date().toISOString().split('T')[0];
             loadDateData(document.getElementById('u-date').value);
        } else {
             loadDateData(document.getElementById('u-date').value);
        }
    }

// --- HÀM MỚI: CHỈ CẬP NHẬT MIN VOLUME & GỬI TELEGRAM (ADMIN ONLY) ---
async function saveAdminTargetOnly() {
    if (!document.body.classList.contains('is-admin')) return;
    
    let btn = document.querySelector('#updateModal .btn-warning');
    let orgHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        let rawId = document.getElementById('u-db-id').value;
        let dbId = parseInt(rawId);
        let c = compList.find(x => x.db_id === dbId);
        let date = document.getElementById('u-date').value;
        let minInput = document.getElementById('u-min-vol');

        if (minInput.value.trim() === "") throw new Error("Min Volume is empty!");

        let minValStr = minInput.value.replace(/,/g, '');
        let t = parseFloat(minValStr);

        // 1. Cập nhật dữ liệu Admin vào biến cục bộ
        if (!Array.isArray(c.history)) c.history = [];
        c.history = c.history.filter(h => h.date !== date); // Xóa cũ nếu trùng ngày
        c.history.push({ date: date, target: t });
        c.history.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 2. Lưu lên Server
        await saveToCloud(c);

        // 3. Gửi Telegram
        let newMinVol = new Intl.NumberFormat('en-US').format(t);
        //await sendTelePhoto(c, newMinVol);

        showToast("✅ Target Updated & Alert Sent!", "success");
        
        // Vẽ lại biểu đồ để thấy thay đổi ngay
        renderTrackerChart(c);
        renderHistoryList(c);
        renderGrid();

    } catch (e) {
        console.error(e);
        showToast("Error: " + e.message, "error");
    } finally {
        btn.innerHTML = orgHtml; btn.disabled = false;
    }
}

  // --- HÀM LƯU TIẾN ĐỘ CÁ NHÂN (Đã sửa lỗi cú pháp) ---
async function saveUpdate() {
    // 1. Kiểm tra đăng nhập
    if (!currentUser) return showToast("Please login first!", "error");

    // 2. Xử lý giao diện nút bấm (Loading)
    let btn = document.getElementById('btn-save-progress');
    let orgText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
    btn.disabled = true;

    try {
        // 3. Lấy dữ liệu ID và Ngày từ giao diện
        let rawId = document.getElementById('u-db-id').value;
        let dbId = parseInt(rawId);
        
        // Tìm giải đấu tương ứng để lát nữa vẽ lại biểu đồ
        let c = compList.find(x => x.db_id === dbId);
        if (!c) throw new Error("Tournament not found");

        let date = document.getElementById('u-date').value;

        // 4. Thu thập dữ liệu từ các ô nhập liệu (Volume & Cost)
        let my = {};
        if (typeof accSettings !== 'undefined' && Array.isArray(accSettings)) {
            accSettings.forEach(acc => {
                let volInput = document.getElementById(`u-vol-${acc.id}`);
                let costInput = document.getElementById(`u-cost-${acc.id}`);
                
                let v = volInput ? parseFloat(volInput.value || 0) : 0;
                let cost = costInput ? parseFloat(costInput.value || 0) : 0;

                my[acc.id] = { vol: v, cost: cost };
            });
        }

        // 5. Chuẩn bị dữ liệu để lưu vào Profile
        if (!userProfile.tracker_data) userProfile.tracker_data = {};
        if (!userProfile.tracker_data[dbId]) userProfile.tracker_data[dbId] = [];

        // Xóa dữ liệu cũ của ngày đang chọn (để ghi đè mới)
        userProfile.tracker_data[dbId] = userProfile.tracker_data[dbId].filter(p => p.date !== date);

        // Chỉ thêm vào danh sách nếu người dùng có nhập dữ liệu (> 0)
        let hasData = Object.values(my).some(x => x.vol > 0 || x.cost > 0);
        if (hasData) {
            userProfile.tracker_data[dbId].push({ date: date, accsDetail: my });
        }

        // 6. Gửi lên Server (Supabase)
        // Lệnh await này nằm TRONG hàm async và TRONG khối try -> Chạy đúng
        const { error } = await supabase
            .from('profiles')
            .update({ tracker_data: userProfile.tracker_data })
            .eq('id', currentUser.id);

        if (error) throw error;

        // 7. Thông báo thành công
        showToast("Personal Data saved successfully!", "success");

        // Đổi màu nút để báo hiệu thành công
        btn.innerHTML = '<i class="fas fa-check"></i> SAVED!';
        btn.style.background = "#0ECB81";
        btn.style.color = "#000";

        // Sau 1 giây thì reset nút và vẽ lại biểu đồ
        setTimeout(() => {
            btn.innerText = orgText;
            btn.style.background = "";
            btn.style.color = "";
            btn.disabled = false;

            // Cập nhật lại giao diện ngay lập tức
            if (typeof renderTrackerChart === 'function') renderTrackerChart(c);
            if (typeof renderHistoryList === 'function') renderHistoryList(c);
            if (typeof renderGrid === 'function') renderGrid();
        }, 1000);

    } catch (e) {
        // Xử lý lỗi nếu có
        console.error("Save Error:", e);
        showToast("Error: " + (e.message || e), "error");
        
        btn.innerText = "ERROR";
        setTimeout(() => { 
            btn.innerText = orgText; 
            btn.disabled = false; 
        }, 3000);
    }
}

    // ADMIN: AUTOMATED SETTLE REWARDS (V45 SECURITY UPGRADE)
    async function settleTournament() {
        if(!confirm("CONFIRM: End tournament and distribute rewards automatically (Server-side)?")) return;

        let c = compList.find(x => x.db_id == currentPolyId);

        document.getElementById('loading-overlay').style.display = 'flex';

        // CALL RPC FUNCTION INSTEAD OF JS LOGIC
        const { data, error } = await supabase.rpc('settle_tournament', { tourn_id: parseInt(currentPolyId) });

        document.getElementById('loading-overlay').style.display = 'none';

        if(error) {
            console.error(error);
            showToast("Settlement Failed: " + error.message, "error");
        } else if (data.status === 'error') {
            showToast("Logic Error: " + data.message, "error");
        } else {
            showToast("SETTLEMENT COMPLETE! Check History.", "success");
            alert(`Result (Min Vol): ${fmtNum(data.actualVol)}\nPool: ${data.pool} $\nWinners:\n${data.winners.join('\n')}`);
            loadFromCloud();
        }
    }

    // --- HÀM ĐỒNG BỘ DỮ LIỆU CŨ LÊN MÂY (MIGRATION TOOL) ---
    async function syncLocalToCloud() {
    if(!currentUser) return showToast("Please login first!", "error"); // Đã sửa

    // Đã sửa confirm
    if(!confirm("This action will OVERWRITE Cloud data with local data. Are you sure?")) return;

    let migrationData = {};
    let count = 0;

    for(let i=0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if(key.startsWith('wave_progress_')) {
            let dbId = key.replace('wave_progress_', '');
            try {
                let data = JSON.parse(localStorage.getItem(key));
                migrationData[dbId] = data;
                count++;
            } catch(e) {}
        }
    }

    if(count === 0) return showToast("No local data found on this device!", "error"); // Đã sửa

    let btn = document.querySelector('button[onclick="syncLocalToCloud()"]');
    let oldText = btn.innerHTML;
    btn.innerHTML = "UPLOADING..."; btn.disabled = true;

    const { error } = await supabase.from('profiles').update({ tracker_data: migrationData }).eq('id', currentUser.id);

    btn.innerHTML = oldText; btn.disabled = false;

    if(error) {
        showToast("Error: " + error.message, "error"); // Đã sửa
    } else {
        showToast(`Success! Migrated ${count} tournaments to Cloud.`, "success"); // Đã sửa
        if(userProfile) userProfile.tracker_data = migrationData;
        renderGrid();
        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
    }
}

    // Standard Utils
        function openSettingsModal() {
        let list = document.getElementById('settingsList');
        list.innerHTML = '';
        accSettings.forEach((acc, i) => {
            list.innerHTML += `
            <div class="d-flex align-items-center gap-2">
                <input type="color" class="form-control form-control-color" value="${acc.color}" onchange="updateAccColor(${i}, this.value)" style="height:35px;width:50px">
                <input value="${acc.name}" class="form-control form-control-sm" onchange="updateAccName(${i}, this.value)" placeholder="Account Name">
                <button class="btn btn-sm btn-outline-danger border-0" onclick="delAcc(${i})"><i class="fas fa-trash"></i></button>
            </div>`;
        });
        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    }

    // --- CẬP NHẬT CÁC HÀM QUẢN LÝ VÍ (CÓ GỌI SYNC CLOUD) ---

function updateAccName(i, val) { 
    accSettings[i].name = val; 
    localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
    updateCloudWallets(); // <--- Thêm dòng này
    renderGrid(); 
}

function updateAccColor(i, val) { 
    accSettings[i].color = val; 
    localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
    updateCloudWallets(); // <--- Thêm dòng này
    renderGrid(); 
}

function addNewAccount() { 
    accSettings.push({
        id: 'acc_' + Date.now(), 
        name: document.getElementById('newAccName').value || 'New', 
        color: document.getElementById('newAccColor').value
    }); 
    localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
    updateCloudWallets(); // <--- Thêm dòng này
    openSettingsModal(); 
    renderGrid(); 
}

function delAcc(i) { 
    if(confirm("Delete?")) { 
        accSettings.splice(i, 1); 
        localStorage.setItem('wave_settings', JSON.stringify(accSettings)); 
        updateCloudWallets(); // <--- Thêm dòng này
        openSettingsModal(); 
        renderGrid(); 
    } 
}
        /* --- CÁC HÀM QUẢN LÝ ADMIN (ĐÃ FIX LOGIC CAMPAIGN & PRICE) --- */

    // 1. Mở Modal tạo mới
    function openCreateModal() {
        document.getElementById('c-db-id').value = '';

        // Reset các ô nhập liệu
        document.getElementById('c-contract').value = '';
        document.getElementById('c-symbol').value = '';
        document.getElementById('c-chain').value = ''; // VD: arbitrum
        document.getElementById('c-price').value = '';
        document.getElementById('c-logo').value = '';
        document.getElementById('c-logo-preview').style.display = 'none';

        document.getElementById('c-rewardQty').value = '';
        document.getElementById('c-winners').value = '';

        // Reset ô nhập Token Campaign
        let tokenInput = document.getElementById('c-inputTokens');
        if(tokenInput) tokenInput.value = '';

        // Ẩn nút xóa
        document.getElementById('btnDeleteComp').style.display = 'none';

        new bootstrap.Modal(document.getElementById('compModal')).show();
    }

    // --- 1. ADMIN EDIT: LẤY DỮ LIỆU THÔ TỪ DB HIỆN LÊN (KHÔNG CONVERT) ---
function openEditModal(id) {
    let c = compList.find(x => x.db_id == id);
    if(!c) return;

    document.getElementById('c-db-id').value = id;
    document.getElementById('c-contract').value = c.contract;
    document.getElementById('c-symbol').value = c.name;
    document.getElementById('c-chain').value = c.chain;
    document.getElementById('c-price').value = c.cachedPrice;
    document.getElementById('c-logo').value = c.logo;
    let imgPreview = document.getElementById('c-logo-preview');
    if(c.logo) { imgPreview.src = c.logo; imgPreview.style.display = 'block'; }
    else { imgPreview.style.display = 'none'; }

    document.getElementById('c-rewardQty').value = c.rewardQty;
    document.getElementById('c-winners').value = c.topWinners;
    document.getElementById('c-alphaType').value = c.alphaType;
    document.getElementById('c-rule').value = c.ruleType;

    // --- NGÀY GIỜ: HIỂN THỊ Y NGUYÊN (ADMIN TỰ HIỂU LÀ UTC) ---
    document.getElementById('c-start').value = c.start;
    document.getElementById('c-start-time').value = c.startTime || "00:00"; // <--- THÊM DÒNG NÀY
    document.getElementById('c-end').value = c.end;
    document.getElementById('c-end-time').value = c.endTime;
    
    // Listing Time (DB lưu "YYYY-MM-DDTHH:mm", Input cũng dùng định dạng đó -> Khớp)
    document.getElementById('c-listing').value = c.listingTime || '';

    let tokenInput = document.getElementById('c-inputTokens');
    if(tokenInput) {
        if (c.inputTokens && Array.isArray(c.inputTokens)) tokenInput.value = c.inputTokens.join(', ');
        else tokenInput.value = '';
    }

    toggleListingTime();
    document.getElementById('btnDeleteComp').style.display = 'inline-block';
    new bootstrap.Modal(document.getElementById('compModal')).show();
}

            // 3. Logic bật tắt ô nhập giờ Listing
    function toggleListingTime() {
        document.getElementById('c-listing').disabled = document.getElementById('c-alphaType').value === 'none';
    }

    // --- 2. ADMIN SAVE: LƯU Y NGUYÊN (KHÔNG CONVERT) ---
function saveComp() {
    let id = document.getElementById('c-db-id').value;
    let c = id ? compList.find(x => x.db_id == id) : {};

    let tokensArr = [];
    let tokenInput = document.getElementById('c-inputTokens');
    if (tokenInput && tokenInput.value.trim() !== "") {
        tokensArr = tokenInput.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s !== '');
    }

    let obj = {
        db_id: id ? parseInt(id) : null,
        name: document.getElementById('c-symbol').value.toUpperCase(),
        contract: document.getElementById('c-contract').value,
        chain: document.getElementById('c-chain').value,
        logo: document.getElementById('c-logo').value,
        cachedPrice: document.getElementById('c-price').value,
        rewardQty: document.getElementById('c-rewardQty').value,
        topWinners: document.getElementById('c-winners').value,
        
        // LƯU THẲNG GIÁ TRỊ NHẬP VÀO
        start: document.getElementById('c-start').value,
        startTime: document.getElementById('c-start-time').value, // <--- THÊM DÒNG NÀY
        end: document.getElementById('c-end').value,
        endTime: document.getElementById('c-end-time').value,
        listingTime: document.getElementById('c-listing').value,

        alphaType: document.getElementById('c-alphaType').value,
        ruleType: document.getElementById('c-rule').value,
        inputTokens: tokensArr,
        history: c.history || [],
        predictions: c.predictions || [],
        comments: c.comments || []
    };

    saveToCloud(obj);
    bootstrap.Modal.getInstance(document.getElementById('compModal')).hide();
}

    // 5. Xóa giải đấu
    function deleteComp() {
        if(confirm('Delete this tournament?')) {
            deleteFromCloud(document.getElementById('c-db-id').value);
            bootstrap.Modal.getInstance(document.getElementById('compModal')).hide();
        }
    }

    // 6. Hàm gọi Server xóa
    async function deleteFromCloud(id) {
        await supabase.from('tournaments').delete().eq('id', id);
        loadFromCloud();
    }


    async function fetchTokenInfo(q) {
        if(!q) return;
        try {
            let r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${q}`);
            let d = await r.json();
            if(d.pairs && d.pairs.length) {
                let p = d.pairs[0];
                document.getElementById('c-symbol').value = p.baseToken.symbol;
                document.getElementById('c-price').value = p.priceUsd;
                document.getElementById('c-chain').value = p.chainId;

                let logoUrl = p.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/${p.chainId}/${p.baseToken.address}.png`;
                document.getElementById('c-logo').value = logoUrl;
                let img = document.getElementById('c-logo-preview');
                img.src = logoUrl; img.style.display = 'block';
            }
        } catch(e){}
    }

        // ============================================================
    // [FIX TIME] RENDER STATS - KHÔNG BỎ SÓT TOKEN CÒN HẠN TRONG NGÀY
    // ============================================================
    function renderStats() {
        const now = new Date();
        let activeCount = 0;
        let totalEstValue = 0;

        let maxRewardVal = 0;
        let topToken = null;

        const fmt = (num) => new Intl.NumberFormat('en-US', { 
            style: 'currency', currency: 'USD', maximumFractionDigits: 0 
        }).format(num);

        compList.forEach(c => {
            // --- 1. XỬ LÝ THỜI GIAN (QUAN TRỌNG) ---
            let endDateTime;

            // Trường hợp A: Có trường end_time đầy đủ (ví dụ: "2025-12-25T11:00:00")
            if (c.end_time) {
                let t = c.end_time;
                if (!t.endsWith("Z")) t += "Z"; // Ép về UTC
                endDateTime = new Date(t);
            } 
            // Trường hợp B: Dữ liệu tách riêng Ngày (c.end) và Giờ (c.endTime)
            else if (c.end) {
                // Nếu có giờ thì dùng giờ đó (endTime), nếu không có thì cho sống đến hết ngày (23:59:59)
                let timePart = c.endTime || "23:59:59"; 
                
                // Ghép thành chuỗi chuẩn UTC: YYYY-MM-DD + T + HH:mm:ss + Z
                let fullTimeStr = `${c.end}T${timePart}`;
                if (!fullTimeStr.endsWith("Z")) fullTimeStr += "Z";
                
                endDateTime = new Date(fullTimeStr);
            } 
            else {
                // Nếu không có ngày kết thúc -> Mặc định là token vĩnh viễn (Active)
                endDateTime = new Date("2099-12-31T23:59:59Z");
            }

            // --- 2. KIỂM TRA: CÒN HẠN KHÔNG? ---
            // So sánh thời điểm hiện tại với hạn chót (tính từng giây)
            if (now.getTime() < endDateTime.getTime()) {
                activeCount++;

                // Tính toán tiền thưởng
                let qty = parseFloat(c.reward_qty || c.rewardQty || 0);
                
                // --- FIX: Ưu tiên Market Analysis ---
let price = 0;
if (c.market_analysis && c.market_analysis.price) {
    price = parseFloat(c.market_analysis.price);
} else if (c.data && c.data.price) {
    price = parseFloat(c.data.price); // Fallback dữ liệu cũ
}

                let currentVal = qty * price;
                totalEstValue += currentVal;

                // Tìm Top 1
                if (currentVal > maxRewardVal) {
                    maxRewardVal = currentVal;
                    topToken = c;
                }
            }
        });

        // ========================================================
        // CẬP NHẬT GIAO DIỆN
        // ========================================================
        
        // 1. Số giải đang chạy
        const elActive = document.getElementById('stat-active');
        if (elActive) elActive.innerText = activeCount;

        // 2. Tổng giá trị Pool
        const elPool = document.getElementById('stat-pool');
        if (elPool) elPool.innerText = fmt(totalEstValue);

        // 3. Highest Reward
        const elTopSym = document.getElementById('stat-top-symbol');
        const elTopVal = document.getElementById('stat-top-val');
        const elTopImg = document.getElementById('stat-top-img');

        if (topToken) {
            if (elTopSym) elTopSym.innerText = topToken.name;
            if (elTopVal) elTopVal.innerText = fmt(maxRewardVal);
            
            if (elTopImg) {
                if (topToken.logo) {
                    elTopImg.src = topToken.logo;
                    elTopImg.style.display = 'block';
                } else {
                    elTopImg.style.display = 'none';
                }
            }
        } else {
            // Không có giải nào
            if (elTopSym) elTopSym.innerText = "---";
            if (elTopVal) elTopVal.innerText = "$0";
            if (elTopImg) elTopImg.style.display = 'none';
        }
    }


        // --- [V61 FINAL] SYSTEM CLOCK: STANDARD UTC+0 ---
function updateClock() {
    const now = new Date();

    // 1. HIỂN THỊ GIỜ HỆ THỐNG (LUÔN LÀ UTC)
    if(document.getElementById('sysClock')) {
        // Lấy ngày giờ theo chuẩn UTC
        let dateStr = now.toLocaleDateString('en-GB', { 
            day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' 
        });
        let timeStr = now.toLocaleTimeString('en-GB', {
            hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: 'UTC'
        });

        document.getElementById('sysClock').innerText = `${dateStr} ${timeStr}`;
        document.getElementById('sysClock').style.fontSize = "1rem"; 

        // Luôn ghi chú là UTC để user không nhầm lẫn
        let labelEl = document.querySelector('[data-i18n="sys_time"]');
        if(labelEl) {
            let baseText = translations[currentLang].sys_time;
            labelEl.innerText = `${baseText} (UTC)`; 
            labelEl.style.color = "var(--brand)";
            labelEl.style.fontWeight = "bold";
        }
    }

    // 2. Cập nhật các bộ đếm ngược (X4 Timer - Dùng chuẩn UTC)
    document.querySelectorAll('.x4-timer-val').forEach(el => {
        const listDateStr = el.dataset.list; // Chuỗi ngày giờ từ DB (UTC)
        if(listDateStr) {
            // Thêm 'Z' để báo là UTC
            let endTimeStr = listDateStr.includes('T') ? listDateStr : listDateStr + 'T00:00:00';
            const endTime = new Date(endTimeStr + 'Z').getTime() + (30*24*60*60*1000);
            const dist = endTime - now.getTime();
            if(dist < 0) { el.innerText="EXPIRED"; el.style.color='#555'; }
            else {
                const d = Math.floor(dist/(1000*60*60*24));
                const h = Math.floor((dist%(1000*60*60*24))/(1000*60*60));
                el.innerText = `${d}d ${h}h`;
            }
        }
    });

    // 3. Smart Timer (Nếu có dùng ở đâu đó)
    document.querySelectorAll('.smart-timer').forEach(el => {
        let endDateStr = el.dataset.end;
        let endTimeStr = el.dataset.time;
        if(!endDateStr) return;
        // Thêm 'Z' vào cuối để tính theo UTC
        let endDateTime = new Date(endDateStr + 'T' + endTimeStr + 'Z'); 
        let diff = endDateTime - now;
        
        if (diff < 0) { 
            el.innerText = "ENDED"; 
            el.style.color = 'var(--text-sub)';
            el.classList.remove('anim-breathe');
            return; 
        }

        // Logic hiển thị
        let todayUTC = new Date().toISOString().split('T')[0];
        if (endDateStr === todayUTC) {
            let h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            let m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            let s = Math.floor((diff % (1000 * 60)) / 1000);
            el.innerText = `${h}h ${m}m ${s}s`;
            el.style.color = 'var(--brand)';
            el.classList.add('anim-breathe');
        } else {
            el.innerText = endDateStr;
            el.style.color = '';
            el.classList.remove('anim-breathe');
        }
    });

    // 4. Đồng hồ trang chi tiết (View Predict) - Dùng chuẩn UTC
    if (currentPolyId && document.getElementById('view-predict').style.display === 'block') {
        let c = compList.find(x => x.db_id == currentPolyId);
        let timerEl = document.getElementById('pt-time');
        if (c && c.end && timerEl) {
            // Thêm 'Z' chuẩn UTC
            let endTime = new Date(c.end + 'T' + (c.endTime || '23:59:59') + 'Z').getTime(); 
            let dist = endTime - now.getTime();
            if (dist < 0) {
                timerEl.innerText = "MARKET CLOSED";
                timerEl.className = "text-danger font-num fw-bold fs-3";
            } else {
                let d = Math.floor(dist / (1000 * 60 * 60 * 24));
                let h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                let m = Math.floor((dist % (1000 * 60 * 60)) / (1000 * 60));
                timerEl.innerText = `${d}d : ${h}h : ${m}m`;
                timerEl.className = "text-gold font-num fw-bold fs-3 anim-breathe";
            }
        }
    }
}


/* ============================================================
   V47: SILENT RELOAD (CẬP NHẬT MƯỢT MÀ KHÔNG NHÁY MÀN HÌNH)
   ============================================================ */
// --- [FIXED] HÀM CẬP NHẬT NGẦM AN TOÀN (SAFE RELOAD) ---
async function silentReload(id) {
    // 1. Âm thầm lấy dữ liệu mới
    const { data: predsData, error } = await supabase.from('predictions').select('*').eq('tournament_id', id);
    if (error) return console.error(error);

    // 2. Cập nhật dữ liệu vào bộ nhớ
    let c = compList.find(x => x.db_id == id);
    if (c && predsData) {
        c.predictions = predsData.map(p => ({
            user_id: p.user_id, name: p.user_name, avatar: p.user_avatar,
            guess: parseFloat(p.guess), time: new Date(p.created_at).getTime()
        }));

        // 3. Cập nhật Pool & Min Vol (Chỉ update nếu tìm thấy ID trên màn hình)
        let pool = (c.predictions.length || 0) * PREDICT_FEE;
        let poolEl = document.getElementById('pt-pool');
        if(poolEl) poolEl.innerText = fmt(pool);

        let curMin = (c.history && c.history.length > 0) ? c.history[c.history.length - 1].target : 0;

        // 4. Cập nhật Bảng Xếp Hạng (Leaderboard) - QUAN TRỌNG: CÓ KIỂM TRA TỒN TẠI
        // --- ĐOẠN CODE DÙNG CHUNG CHO CẢ 2 VỊ TRÍ (Paste đè vào đoạn số 4 và số 7) ---
        let lb = document.getElementById('pt-leaderboard');
        if (lb) { 
            lb.innerHTML = ''; 
            
            // --- LOGIC XẾP HẠNG MỚI (Đồng bộ với hàm trên) ---
            let preds = (c.predictions || []).sort((a, b) => {
                let aValid = a.guess >= curMin;
                let bValid = b.guess >= curMin;

                if (aValid && !bValid) return -1;
                if (!aValid && bValid) return 1;

                if (aValid && bValid) {
                    if (a.guess !== b.guess) return a.guess - b.guess;
                } else {
                    if (a.guess !== b.guess) return b.guess - a.guess;
                }
                return a.time - b.time;
            });
            
            if(preds.length === 0) lb.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-sub opacity-50">No Data</td></tr>';

            preds.forEach((p, i) => {
                // Kiểm tra lại lần nữa để tô màu
                let isValid = p.guess >= curMin;
                
                // Top 1,2,3 màu Vàng/Bạc/Đồng. Còn lại màu xám. Người thua cuộc màu tối hơn.
                let rankColor = isValid 
                    ? (i===0?'#FFD700':(i===1?'#C0C0C0':(i===2?'#CD7F32':'#666'))) 
                    : '#333'; 

                let rankText = isValid ? `#${i + 1}` : '<i class="fas fa-times"></i>'; // Hiện dấu X nếu loại

                let badgeHtml = `<span class="rank-badge" style="background:${rankColor}; color:${isValid && i<3 ? '#000' : '#fff'}; border:1px solid #444">${rankText}</span>`;
                
                let avatarHtml = p.avatar ? `<img src="${p.avatar}" class="list-avatar">` : `<div class="list-avatar-placeholder">${p.name.substring(0, 1).toUpperCase()}</div>`;
                
                // Highlight chính mình
                let myName = document.getElementById('modal-p-name')?.value || '';
                let highlightClass = (p.name === myName) ? 'anim-breathe' : '';
                
                // Làm mờ dòng bị loại (Opacity 0.4)
                let rowStyle = isValid ? '' : 'opacity: 0.4; filter: grayscale(1);';

                lb.innerHTML += `
                <tr class="${highlightClass}" style="${rowStyle}">
                    <td class="ps-4 align-middle">${badgeHtml}</td>
                    <td class="align-middle">
                        <div class="d-flex align-items-center gap-2">
                            ${avatarHtml}
                            <span class="text-white small fw-bold">${p.name}</span>
                        </div>
                    </td>
                    <td class="text-end pe-4 align-middle font-num fw-bold" style="color:${isValid ? 'var(--brand)' : '#666'}">
                        ${fmtNum(p.guess)}
                    </td>
                </tr>`;
            });
        }
        
        // 5. [FIX] Bỏ qua cập nhật 'content-activity' vì giao diện mới không dùng nữa
        // (Hoặc nếu bạn muốn dùng lại sau này, hãy thêm if(actDiv) như dưới đây)
        let actDiv = document.getElementById('content-activity');
        if (actDiv) {
            actDiv.innerHTML = '';
            // Logic cũ nếu cần...
        }
    }
}

    init();
    // --- BACKUP & RESTORE LOGIC (ENGLISH) ---
function backupData() {
    let data = {};
    // Get all Wave Alpha related data
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if (key.startsWith('wave_')) {
            data[key] = localStorage.getItem(key);
        }
    }
    // Create download file
    let blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let date = new Date().toISOString().slice(0,10);
    a.download = 'WaveAlpha_Backup_' + date + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Notification in English
    alert("Backup file downloaded successfully!");
}

function restoreData(input) {
    let file = input.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data = JSON.parse(e.target.result);
            for (let key in data) {
                localStorage.setItem(key, data[key]);
            }
            alert("Data restored successfully! Page reloading...");
            window.location.reload();
        } catch (err) {
            alert("Error: Invalid backup file!");
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input
}
// ----------------------------------------

    /* ================= ARSENAL DYNAMIC CONFIG LOGIC ================= */

    // 1. Hàm vẽ lại danh sách Input trong Modal từ dữ liệu đã lưu
    function renderArsenalInputs(items = []) {
        const container = document.getElementById('cfg-arsenal-list');
        container.innerHTML = '';

        items.forEach((item, index) => {
            addArsenalItem(item, index);
        });
    }

    // 2. Hàm thêm một dòng nhập liệu mới (hoặc vẽ dòng cũ)
    function addArsenalItem(data = null, index = null) {
        const container = document.getElementById('cfg-arsenal-list');
        const uniqueId = Date.now() + Math.random().toString(36).substr(2, 9); // Tạo ID ngẫu nhiên

        const name = data ? data.name : '';
        const link = data ? data.link : '';
        const logo = data ? data.logo : '';
        const type = data ? data.type : 'EXCHANGE'; // Mặc định là CEX

        const html = `
        <div class="p-3 rounded border border-secondary border-opacity-25 bg-dark arsenal-item-row" data-id="${uniqueId}">
            <div class="d-flex gap-2 mb-2">
                <input type="text" class="form-control form-control-sm inp-name" placeholder="Tên sàn (VD: Binance)" value="${name}" style="flex:1">
                <select class="form-select form-select-sm inp-type" style="width:130px">
                    <option value="EXCHANGE" ${type==='EXCHANGE'?'selected':''}>Sàn CEX</option>
                    <option value="WEB3 WALLET" ${type==='WEB3 WALLET'?'selected':''}>Binance Wallet</option>
                    <option value="DEX SWAP" ${type==='DEX SWAP'?'selected':''}>Sàn DEX</option>
                </select>
            </div>

            <div class="d-flex gap-2 mb-2 align-items-center">
                <input type="text" class="form-control form-control-sm inp-link" placeholder="Link Ref (https://...)" value="${link}">

                <div class="position-relative btn btn-sm btn-outline-secondary" style="width:35px; overflow:hidden;" title="Logo">
                    <i class="fas fa-camera"></i>
                    <input type="file" onchange="uploadImage(this, 'prev-${uniqueId}', 'val-${uniqueId}')" style="position:absolute;left:0;top:0;opacity:0;cursor:pointer;width:100%;height:100%">
                </div>
                <input type="hidden" class="inp-logo" id="val-${uniqueId}" value="${logo}">
                <img id="prev-${uniqueId}" src="${logo}" style="width:30px;height:30px;object-fit:contain; ${logo?'':'display:none'}; border:1px solid #444; border-radius:4px">
            </div>

            <div class="d-flex justify-content-between">
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-dark border-secondary" onclick="moveItem(this, -1)" title="Lên"><i class="fas fa-arrow-up"></i></button>
                    <button class="btn btn-sm btn-dark border-secondary" onclick="moveItem(this, 1)" title="Xuống"><i class="fas fa-arrow-down"></i></button>
                </div>
                <button class="btn btn-sm btn-outline-danger border-0" onclick="this.closest('.arsenal-item-row').remove()"><i class="fas fa-trash me-1"></i> Xóa</button>
            </div>
        </div>`;

        container.insertAdjacentHTML('beforeend', html);
    }

    // 3. Hàm di chuyển vị trí (Lên/Xuống)
    function moveItem(btn, direction) {
        const row = btn.closest('.arsenal-item-row');
        const container = document.getElementById('cfg-arsenal-list');
        if (direction === -1 && row.previousElementSibling) {
            container.insertBefore(row, row.previousElementSibling);
        } else if (direction === 1 && row.nextElementSibling) {
            container.insertBefore(row.nextElementSibling, row);
        }
    }

// --- [MỚI - ĐÃ FIX] HÀM TÍNH TOÁN TRUNG BÌNH 10S (Rolling Average) ---
function calculateSafeAvg(id, currentTotalVol) {
    // 1. Nếu chưa có dữ liệu lịch sử (Lần chạy đầu tiên)
    if (!tokenVolHistory[id]) {
        tokenVolHistory[id] = {
            history: [],
            lastVol: currentTotalVol, // Ghi nhớ mốc 48 Triệu $
            lastTime: Date.now()
        };
        return 0; // TRẢ VỀ 0 NGAY LẬP TỨC để tránh hiện số 48 Triệu ra màn hình
    }

    let tracker = tokenVolHistory[id];

    // 2. Tính chênh lệch (Delta) so với lần trước
    // Ví dụ: 48,005,000 - 48,000,000 = 5,000
    let delta = currentTotalVol - tracker.lastVol;

    // Cập nhật mốc mới
    tracker.lastVol = currentTotalVol;

    // --- BỘ LỌC NHIỄU QUAN TRỌNG ---
    // Nếu delta < 0 (Sàn reset ngày mới) hoặc delta quá lớn vô lý (> 10% tổng vol 1 lúc)
    // Thì coi như bằng 0 để không làm hỏng biểu đồ
    if (delta < 0 || delta > (currentTotalVol * 0.1)) {
        delta = 0;
    }

    // 3. Đẩy vào mảng lịch sử (Rolling Window)
    tracker.history.push(delta);
    
    // Chỉ giữ lại đúng 10 mẫu gần nhất (10 giây)
    if (tracker.history.length > SAFETY_WINDOW) {
        tracker.history.shift(); // Xóa mẫu cũ nhất
    }

    // 4. TÍNH TRUNG BÌNH CỘNG (AVERAGE)
    // Tổng 10 lần / 10 = Trung bình mỗi giây
    // Ví dụ: Tổng 10s là 50k -> Trung bình là 5k/s
    if (tracker.history.length === 0) return 0;
    let totalInWindow = tracker.history.reduce((a, b) => a + b, 0);
    let avg = totalInWindow / tracker.history.length;

    return avg;
}

// --- LOGIC LỊCH: DEADLINE RADAR (CÓ TỔNG TIỀN) ---
let currentFilterDate = null;

function initCalendar() {
    const container = document.getElementById('calendar-wrapper');
    if (!container) return;
    container.innerHTML = ''; 

    // 1. Thống kê: Số lượng giải & Tổng giá trị theo ngày
    let dateStats = {}; 

    compList.forEach(c => {
        if(c.end) {
            if(!dateStats[c.end]) dateStats[c.end] = { count: 0, totalVal: 0 };
            
            // Tăng biến đếm số lượng
            dateStats[c.end].count++;

            // Tính tiền: Qty * Giá (Ưu tiên giá mới nhất, nếu không có thì lấy giá cache)
            let qty = parseFloat(c.rewardQty) || 0;
            let price = (c.market_analysis && c.market_analysis.price) ? c.market_analysis.price : (c.cachedPrice || 0);
            
            // Cộng dồn vào tổng ngày đó (Tính cả giải đang chạy và đã kết thúc trong ngày)
            dateStats[c.end].totalVal += (qty * price);
        }
    });

    // 2. Vẽ 15 ngày
    const today = new Date();
    let html = '';

    for (let i = 0; i < 15; i++) {
        let d = new Date();
        d.setDate(today.getDate() + i);

        // Format YYYY-MM-DD để so sánh
        let year = d.getFullYear();
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let day = String(d.getDate()).padStart(2, '0');
        let dateStr = `${year}-${month}-${day}`;

        // Hiển thị: THỨ (T2...) & NGÀY (16...)
        let dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        let dayNum = d.getDate();

        // Lấy dữ liệu thống kê của ngày này
        let stat = dateStats[dateStr] || { count: 0, totalVal: 0 };
        
        // HTML Badge số lượng (Nếu có giải thì hiện chấm vàng)
        let badgeHtml = stat.count > 0 ? `<div class="date-dot">${stat.count}</div>` : '';
        
        // HTML Số tiền (Format: 1.5k, 2M...)
        let moneyHtml = '';
        if (stat.totalVal > 0) {
            let val = stat.totalVal;
            let txt = '';
            if (val >= 1000000) txt = '$' + (val / 1000000).toFixed(1) + 'M';
            else if (val >= 1000) txt = '$' + (val / 1000).toFixed(0) + 'k';
            else txt = '$' + Math.round(val);
            
            moneyHtml = `<div class="d-val">${txt}</div>`;
        } else {
            // Để trống 1 dòng ẩn (visibility:hidden) để các ô cao bằng nhau
            moneyHtml = `<div class="d-val" style="visibility:hidden">-</div>`;
        }

        let activeClass = (currentFilterDate === dateStr) ? 'active' : '';

        html += `
            <div class="date-box ${activeClass}" id="dbox-${dateStr}" onclick="filterByDate('${dateStr}')">
                ${badgeHtml}
                <div class="d-name">${dayName}</div>
                <div class="d-num">${dayNum}</div>
                ${moneyHtml}
            </div>
        `;
    }
    container.innerHTML = html;
}

function filterByDate(dateStr) {
    // 1. Nếu bấm "View All" (Hủy lọc)
    if (!dateStr) {
        currentFilterDate = null;
        document.querySelectorAll('.date-box').forEach(el => el.classList.remove('active'));
        
        // Vẽ lại toàn bộ theo tab hiện tại
        switchGlobalTab(appData.currentTab);
        return;
    }

    // 2. Active ô ngày vừa chọn trên lịch
    currentFilterDate = dateStr;
    document.querySelectorAll('.date-box').forEach(el => el.classList.remove('active'));
    let box = document.getElementById(`dbox-${dateStr}`);
    if(box) box.classList.add('active');

    // --- [LOGIC MỚI: TỰ ĐỘNG CHUYỂN TAB THÔNG MINH] ---
    let today = new Date().toISOString().split('T')[0];
    // Nếu ngày chọn >= Hôm nay -> Tự nhảy sang Running. Ngược lại -> History.
    let targetTab = (dateStr >= today) ? 'running' : 'history';

    if (appData.currentTab !== targetTab) {
        switchGlobalTab(targetTab); 
            }
    // --------------------------------------------------

    // 3. Lọc dữ liệu
    let filteredList = compList.filter(c => c.end === dateStr);

    // 4. Vẽ lại giao diện
    renderMarketHealthTable(filteredList);
    if (appData.currentView === 'grid') {
        renderGrid(filteredList);
    }
}

// 3. Kích hoạt ngay lập tức
initCalendar();
// --- HÀM CHUYỂN TAB CHO GIAO DIỆN COCKPIT MỚI ---
// --- HÀM CHUYỂN TAB MỚI (ĐÃ FIX LỖI HIỂN THỊ) ---
function switchCpTab(tabName) {
    // 1. Cập nhật trạng thái nút bấm (Màu sắc)
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');

    // 2. Lấy 2 khung nội dung
    const lbBox = document.getElementById('cp-content-leaderboard');
    const chatBox = document.getElementById('cp-content-chat');

    // 3. Xử lý ẩn hiện (Dùng class mới định nghĩa ở CSS)
    if (tabName === 'leaderboard') {
        // Hiện Leaderboard, Ẩn Chat
        lbBox.classList.remove('hide-force');
        chatBox.classList.remove('chat-visible');
        chatBox.classList.add('d-none'); // Đảm bảo ẩn hẳn
    } else {
        // Ẩn Leaderboard, Hiện Chat
        lbBox.classList.add('hide-force');
        chatBox.classList.remove('d-none'); // Gỡ bỏ class ẩn của Bootstrap
        chatBox.classList.add('chat-visible'); // Kích hoạt Flex để hiện khung chat
        
        // Auto scroll xuống cuối khung chat
        let feed = document.getElementById('chat-feed');
        if(feed) feed.scrollTop = feed.scrollHeight;
    }
}

// --- CẬP NHẬT LẠI HÀM openPredictionView (Để tương thích với giao diện mới) ---
// Bạn Tìm hàm openPredictionView cũ và thay thế bằng hàm này:

async function openPredictionView(id) {
    currentPolyId = id;
    document.getElementById('loading-overlay').style.display = 'flex';

    // 1. Fetch Data
    const { data: predsData, error } = await supabase.from('predictions').select('*').eq('tournament_id', id);
    document.getElementById('loading-overlay').style.display = 'none';

    if (error) { showToast("Error loading data", "error"); return; }

    // 2. Map Data
    let c = compList.find(x => x.db_id == id);
    if(c) {
        c.predictions = predsData.map(p => ({
            user_id: p.user_id, name: p.user_name, avatar: p.user_avatar,
            guess: parseFloat(p.guess), time: new Date(p.created_at).getTime()
        }));
    }

    // 3. Switch View
    // Lưu ý: Giao diện mới dùng z-index đè lên, nên ta chỉ cần show div view-predict
    document.getElementById('view-predict').style.display = 'block';
    
    // 4. Update Data to UI
    updateTerminalData(id);
}

// --- CẬP NHẬT LOGIC NÚT BACK (QUAN TRỌNG) ---
function switchView(view) {
    // 1. Ẩn tất cả trước
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-predict').style.display = 'none';

    // 2. Hiện cái cần thiết
    if (view === 'dashboard') {
        document.getElementById('view-dashboard').style.display = 'block';
        // Reset ID để tránh lỗi vẽ lại
        currentPolyId = null;
        renderGrid();
    } 
    else if (view === 'predict') {
        // Giao diện Cockpit mới dùng display: block thay vì flex
        document.getElementById('view-predict').style.display = 'block';
    }
}

// --- [V75 FINAL LOGIC] CHART: SMART TOOLTIP (CHỈ HIỆN EST. FINAL Ở CỘT CUỐI) ---
function renderCardMiniChart(c) {
    const ctx = document.getElementById(`miniChart-${c.db_id}`);
    if (!ctx) return;

    let now = new Date();

    // 1. TÍNH TOÁN DATA & THỜI GIAN
    let tournamentEndTime = null;
    let isEnded = false;
    if (c.end) {
        tournamentEndTime = new Date(c.end + 'T' + (c.endTime || '23:59:59') + 'Z');
        if (now > tournamentEndTime) isEnded = true;
    }

    let todayMidnight = new Date();
    todayMidnight.setUTCHours(23, 59, 59, 999);
    let projectionTargetTime = todayMidnight;
    
    if (tournamentEndTime && tournamentEndTime < todayMidnight) {
        projectionTargetTime = tournamentEndTime;
    }

    let secondsRemaining = (projectionTargetTime - now) / 1000;
    if (secondsRemaining < 0) secondsRemaining = 0;
    if (isEnded) secondsRemaining = 0;

    let anchorDate = new Date();
    if (isEnded && c.end) {
        let parts = c.end.split('-'); 
        anchorDate = new Date(Date.UTC(parts[0], parts[1]-1, parts[2], 12, 0, 0));
    } else {
        anchorDate.setUTCHours(12, 0, 0, 0);
    }

    let todayStr = now.toISOString().split('T')[0];
    let adminHistory = c.history || [];
    let realHistory = c.real_vol_history || [];
    let myProgress = (userProfile?.tracker_data && userProfile.tracker_data[c.id]) ? userProfile.tracker_data[c.id] : [];
    
    let labels = [];
    let limitVolData = [], projectedData = [], targetData = [];
    let accDatasets = {}; 
    accSettings.forEach(acc => accDatasets[acc.id] = []);

    for (let i = 6; i >= 0; i--) {
        let d = new Date(anchorDate);
        d.setDate(anchorDate.getDate() - i);
        let dStr = d.toISOString().split('T')[0];
        
        if(c.start && dStr < c.start) continue;
        labels.push(d.getUTCDate() + '/' + (d.getUTCMonth()+1));

        // Total Vol
        let rVal = 0;
        let rItem = realHistory.find(x => x.date === dStr);
        if (rItem) rVal = parseFloat(rItem.vol);
        else if (dStr === todayStr) rVal = parseFloat(c.real_alpha_volume || 0);
        limitVolData.push(rVal);

        // Forecast Vol (Chỉ tính cho hôm nay)
        let projVal = 0;
        if (dStr === todayStr && !isEnded && secondsRemaining > 0) {
            let stableSpeed = 0;
            if (c.market_analysis && c.market_analysis.realTimeVol) {
                stableSpeed = parseFloat(c.market_analysis.realTimeVol);
            }
            if (stableSpeed > 0) projVal = stableSpeed * secondsRemaining;
        }
        projectedData.push(projVal);

        // Target
        let tVal = 0;
        let hItem = adminHistory.find(h => h.date === dStr);
        if(hItem) tVal = parseFloat(hItem.target);
        else {
            let prev = adminHistory.filter(h => h.date < dStr).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
            if(prev) tVal = parseFloat(prev.target);
        }
        
        if (dStr === todayStr && !isEnded) {
            targetData.push(null); 
            accSettings.forEach(acc => accDatasets[acc.id].push(null));
        } else {
            targetData.push(tVal);
            let pItem = myProgress.find(p => p.date === dStr);
            accSettings.forEach(acc => {
                let vVal = 0;
                if (pItem && pItem.accsDetail && pItem.accsDetail[acc.id]) vVal = parseFloat(pItem.accsDetail[acc.id].vol);
                else {
                    let prevP = myProgress.filter(p => p.date < dStr).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
                    if(prevP && prevP.accsDetail && prevP.accsDetail[acc.id]) vVal = parseFloat(prevP.accsDetail[acc.id].vol);
                    else vVal = null;
                }
                accDatasets[acc.id].push(vVal);
            });
        }
    }

    // 2. CHECK & UPDATE
    let existingChart = Chart.getChart(`miniChart-${c.db_id}`);
    if (existingChart) {
        existingChart.data.labels = labels;
        existingChart.data.datasets[0].data = limitVolData;
        existingChart.data.datasets[1].data = projectedData;
        existingChart.data.datasets[2].data = targetData;
        accSettings.forEach((acc, index) => {
            if(existingChart.data.datasets[3 + index]) {
                existingChart.data.datasets[3 + index].data = accDatasets[acc.id];
            }
        });
        if(typeof updateGridInfo === 'function') updateGridInfo(c, targetData, accDatasets);
        existingChart.update('none'); 
        return; 
    }

    // 3. DRAW NEW CHART
    let chartDatasets = [
        {
            type: 'bar', label: 'Current', 
            data: limitVolData,
            backgroundColor: (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(0, 240, 255, 0.9)');
                gradient.addColorStop(1, 'rgba(0, 240, 255, 0.1)');
                return gradient;
            },
            borderRadius: 4, order: 3, stack: 'volStack', yAxisID: 'y_limit'
        },
        {
            type: 'bar', label: 'Forecast (+)', 
            data: projectedData,
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            borderColor: 'rgba(255, 255, 255, 0.5)',
            borderWidth: {top: 2, right: 2, left: 2, bottom: 0}, 
            borderDash: [4, 4],
            borderRadius: 4, order: 3, stack: 'volStack', yAxisID: 'y_limit'
        },
        {
            type: 'line', label: 'Target', data: targetData,
            borderColor: '#F0B90B', borderWidth: 2, borderDash: [3, 3],
            pointRadius: 2, pointHoverRadius: 5, pointBackgroundColor: '#000', pointBorderColor: '#F0B90B',
            pointBorderWidth: 2, pointHitRadius: 10, 
            fill: false, tension: 0.3, order: 2, yAxisID: 'y_user'
        }
    ];

    accSettings.forEach(acc => {
        chartDatasets.push({
            type: 'line', label: acc.name, data: accDatasets[acc.id],
            borderColor: acc.color, backgroundColor: hexToRgba(acc.color, 0.1), borderWidth: 2,
            pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#161a1e', pointBorderColor: acc.color,
            pointBorderWidth: 2, pointHitRadius: 15,
            fill: false, tension: 0.3, order: 1, yAxisID: 'y_user'
        });
    });

    new Chart(ctx, {
        data: { labels: labels, datasets: chartDatasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false, axis: 'x' },
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    backgroundColor: 'rgba(22, 26, 30, 0.95)', 
                    titleColor: '#888',
                    padding: 10,
                    cornerRadius: 6,
                    displayColors: true, 
                    callbacks: {
                        label: function(ctx) {
                            let val = ctx.raw; if (!val) return null;
                            let valStr = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val);
                            
                            // Chỉ hiện Text, bỏ Icon
                            if (ctx.dataset.label === 'Current') return ` Current: $${valStr}`;
                            if (ctx.dataset.label === 'Forecast (+)') return ` Forecast: +$${valStr}`;
                            
                            return ` ${ctx.dataset.label}: ${valStr}`;
                        },
                        footer: function(tooltipItems) {
                            let total = 0; 
                            let forecastVal = 0; // Biến kiểm tra xem có dự báo không
                            
                            tooltipItems.forEach(t => { 
                                if(t.dataset.stack === 'volStack') { 
                                    total += t.raw; 
                                    // Kiểm tra xem cột Forecast của ngày này có giá trị không
                                    if(t.dataset.label.includes('Forecast')) {
                                        forecastVal = t.raw;
                                    }
                                } 
                            });

                            // --- [LOGIC MỚI] ---
                            // Chỉ hiện Est. Final nếu cột Forecast > 0
                            // (Nghĩa là chỉ hiện ở cột ngày hôm nay khi đang chạy)
                            // Các ngày quá khứ (forecast = 0) sẽ KHÔNG hiện dòng này nữa.
                            if (forecastVal > 0) {
                                return '----------------\n🏁 Est. Final: $' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(total);
                            }
                            return '';
                        }
                    } 
                }
            },
            scales: {
                x: { display: false },
                y_user: { display: false, position: 'left', min: 0 },
                y_limit: { display: false, position: 'right', min: 0, stacked: true, suggestedMax: Math.max(...limitVolData) * 1.5 }
            },
            layout: { padding: { top: 10, bottom: 5 } }
        }
    });

    if(typeof updateGridInfo === 'function') updateGridInfo(c, targetData, accDatasets);
}

    
    // --- HÀM PHỤ: CẬP NHẬT THÔNG SỐ GRID BÊN DƯỚI BIỂU ĐỒ ---
function updateGridInfo(c, targetData, accDatasets) {
    let accGridEl = document.getElementById(`accGrid-${c.db_id}`);
    
    // Tìm giá trị Target mới nhất (bỏ qua null)
    let lastTargetData = targetData.filter(v => v !== null);
    let lastTarget = lastTargetData.length > 0 ? lastTargetData[lastTargetData.length - 1] : 0;

    if(accGridEl) {
        let gridHtml = '';
        accSettings.forEach(acc => {
            // Tìm giá trị User mới nhất (bỏ qua null)
            let validUser = accDatasets[acc.id].filter(v => v !== null);
            let lastUserVal = validUser.length > 0 ? validUser[validUser.length - 1] : 0;
            
            // Tính khoảng cách Gap
            let gap = lastUserVal - lastTarget;
            let gapColor = gap >= 0 ? 'text-green' : 'text-red';
            let gapIcon = gap >= 0 ? 'fa-caret-up' : 'fa-caret-down';
            
            gridHtml += `
            <div class="as-item">
                <div class="as-head"><div class="dot" style="background:${acc.color}"></div> ${acc.name}</div>
                <div class="as-vol">${fmtNum(lastUserVal)}</div>
                <div class="as-gap ${gapColor}">
                    ${lastTarget > 0 ? `<i class="fas ${gapIcon}"></i> ${fmtNum(Math.abs(gap))}` : '<span class="text-sub opacity-50">--</span>'}
                </div>
            </div>`;
        });
        accGridEl.innerHTML = gridHtml;
    }
}

// Helper: Chuyển HEX sang RGBA
function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
// --- [NEW] HÀM ĐỒNG BỘ VÍ LÊN CLOUD ---
async function updateCloudWallets() {
    if (!currentUser || !userProfile) return;

    // Đảm bảo tracker_data tồn tại
    if (!userProfile.tracker_data) userProfile.tracker_data = {};

    // Gán cấu hình hiện tại vào key 'meta_wallets'
    userProfile.tracker_data.meta_wallets = accSettings;

    // Lưu lên Supabase (Âm thầm)
    await supabase.from('profiles').update({ 
        tracker_data: userProfile.tracker_data 
    }).eq('id', currentUser.id);
    
    console.log("✅ Wallets config synced to Cloud");
}

// --- [NEW] REALTIME CHART LOOP (TỰ ĐỘNG CẬP NHẬT CHART MỖI 5 GIÂY) ---
setInterval(() => {
    // Chỉ cập nhật khi User đang xem tab Dashboard (để tiết kiệm pin)
    if (document.hidden) return; 

    // Lặp qua tất cả các giải đấu đang có
    compList.forEach(c => {
        // Chỉ vẽ lại nếu thẻ đang hiển thị trên màn hình (có canvas)
        let canvas = document.getElementById(`miniChart-${c.db_id}`);
        if (canvas) {
            // Gọi lại hàm vẽ (Nó sẽ tự tính lại thời gian secondsRemaining)
            renderCardMiniChart(c);
        }
    });
}, 5000); // 5000ms = 5 giây

/* === BẮT ĐẦU ĐOẠN CODE FIX LỖI === */
document.addEventListener('click', function(e) {
    // Kiểm tra xem người dùng có bấm vào nút Predict (hoặc icon bên trong nó) không
    if (e.target.closest('.btn-predict')) {
        
        // 1. Tìm thẻ cha (.card-item) đang chứa cái nút này
        const currentCard = e.target.closest('.card-item');
        
        // 2. Tắt chế độ phóng to của thẻ bài
        if (currentCard) {
            // Xóa các class thường dùng để phóng to (active, expanded, open...)
            // Code này sẽ thử xóa hết các tên thông dụng, trúng cái nào thì ăn cái đó
            currentCard.classList.remove('active');
            currentCard.classList.remove('expanded');
            currentCard.classList.remove('show');
            currentCard.classList.remove('open');

            // Reset style nếu bạn dùng style inline (đề phòng)
            currentCard.style.zIndex = ''; 
            currentCard.style.position = '';
        }
    }
});
/* === KẾT THÚC ĐOẠN CODE FIX LỖI === */

// --- FEEDBACK LOGIC (ENGLISH) ---
function openFeedbackModal() {
    // Auto-fill name if logged in
    if(typeof userProfile !== 'undefined' && userProfile && userProfile.nickname) {
        document.getElementById('fb-name').value = userProfile.nickname;
    }
    new bootstrap.Modal(document.getElementById('feedbackModal')).show();
}

function selectFbType(btn, type) {
    document.querySelectorAll('.feedback-type-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('fb-type').value = type;
}

async function sendFeedbackToDb() {
    const name = document.getElementById('fb-name').value.trim() || 'Anonymous';
    const type = document.getElementById('fb-type').value;
    const msg = document.getElementById('fb-msg').value.trim();

    if (!msg) return showToast("Please enter your message!", "error");

    let btn = document.querySelector('#feedbackModal .btn-action');
    let oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SENDING...'; btn.disabled = true;

    try {
        const { error } = await supabase.from('feedback').insert({
            sender_name: name,
            type: type,
            message: msg
        });
        if (error) throw error;

        showToast("Sent successfully! Thank you.", "success");
        document.getElementById('fb-msg').value = ''; 
        bootstrap.Modal.getInstance(document.getElementById('feedbackModal')).hide();
    } catch (e) {
        console.error(e);
        showToast("Error: " + e.message, "error");
    } finally {
        btn.innerHTML = oldHtml; btn.disabled = false;
    }
}

// --- TELEGRAM SYSTEM CONFIG (English) ---

const TELE_CONFIG = {
    get token() { return localStorage.getItem('WAVE_TELE_TOKEN'); },
    chatId: '-1003355713341' // <-- ĐIỀN CHANNEL ID CỦA BẠN VÀO ĐÂY
};

// 1. Logic Admin Panel Toggle
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'admin') {
        document.getElementById('admin-control-panel').classList.remove('hidden');
        checkTokenStatus();
    }
});

function closeAdmin() {
    document.getElementById('admin-control-panel').classList.add('hidden');
    window.history.replaceState({}, document.title, "/");
}

// 2. Logic Save Token
window.saveTokenFromUI = function() {
    const inputToken = document.getElementById('bot-token-input').value.trim();
    if (!inputToken) return alert("❌ Token is empty!");
    
    localStorage.setItem('WAVE_TELE_TOKEN', inputToken);
    alert("✅ Token saved to this device!");
    checkTokenStatus();
}

function checkTokenStatus() {
    const statusText = document.getElementById('token-status');
    if (localStorage.getItem('WAVE_TELE_TOKEN')) {
        statusText.innerText = "✅ Status: Token Ready. System Operational.";
        statusText.style.color = "#00ff88";
    } else {
        statusText.innerText = "⚠️ Status: Missing Token.";
        statusText.style.color = "orange";
    }
}

// 3. Logic Send Message (English Content)
window.sendReportFromUI = async function() {
    if (!TELE_CONFIG.token) return alert("⚠️ Token missing! Please save token first.");

    let name = document.getElementById('report-name').value;
    let vol = document.getElementById('report-vol').value;
    let time = document.getElementById('report-time').value;
    let date = new Date().toLocaleDateString('en-GB'); // Định dạng ngày quốc tế DD/MM/YYYY

    // Nội dung tin nhắn Tiếng Anh
    let msg = `
<b>🔔 VOLUME UPDATE (${date})</b>

🏆 <b>Tournament:</b> ${name}
📊 <b>Min Volume:</b> <code>${vol}</code>
⏳ <b>Time Left:</b> ${time}

⚠️ <i>Alert: High volatility detected. Check your position!</i>

👉 <a href="https://t.me/WaveAlphaSignal_bot/miniapp">Open Wave Alpha Terminal</a>
    `;

    const url = `https://api.telegram.org/bot${TELE_CONFIG.token}/sendMessage`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: TELE_CONFIG.chatId,
                text: msg,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
        const data = await res.json();
        if(data.ok) alert("✅ Alert sent to Channel successfully!");
        else alert("❌ Telegram Error: " + data.description);
    } catch (err) {
        alert("❌ Network Error!");
    }
}


    // --- TELEGRAM MINI APP INTEGRATION ---
    document.addEventListener('DOMContentLoaded', function() {
        const tg = window.Telegram.WebApp;
        
        // 1. Báo cho Telegram biết App đã sẵn sàng (để mở rộng full màn hình)
        tg.ready();
        tg.expand(); 

        // 2. Tự động lấy User ID từ Telegram điền vào form Login (Optional)
        // Nếu user mở từ Telegram, ta có thể biết họ là ai ngay
        const user = tg.initDataUnsafe?.user;
        if (user) {
            console.log("User from Tele:", user);
            // Bạn có thể dùng logic này để auto-login hoặc điền tên vào ô dự đoán
            // Ví dụ:
            if(document.getElementById('modal-p-name')) {
                document.getElementById('modal-p-name').value = user.username || user.first_name;
            }
        }

        // 3. Chỉnh màu Header (Chỉ chạy nếu phiên bản >= 6.1)
// Kiểm tra xem hàm có tồn tại và phiên bản có hỗ trợ không để tránh lỗi console
if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
    tg.setHeaderColor('#161a1e');
} else {
    console.log("Telegram version 6.0: Header Color not supported (Skipped)");
}
    });

// ==========================================
// DATA BACKUP & RESTORE SYSTEM
// ==========================================

// 1. Export Data (Download)
function downloadBackup() {
    try {
        // Collect data
        const backupData = {
            app: "WaveAlpha",
            version: "2.0",
            timestamp: new Date().toISOString(),
            settings: typeof accSettings !== 'undefined' ? accSettings : [], // Wallet list
            profile: typeof userProfile !== 'undefined' ? userProfile : null // User profile
        };

        // Create file
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        
        a.href = dataStr;
        a.download = `WaveAlpha_Backup_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        // Notification
        if(typeof showToast === 'function') {
            showToast("✅ Backup file downloaded successfully!", "success");
        } else {
            alert("✅ Backup file downloaded successfully!");
        }
    } catch (e) {
        console.error(e);
        alert("❌ Error creating backup: " + e.message);
    }
}

// 2. Trigger Import
function triggerRestore() {
    const msg = "⚠️ WARNING: IMPORTING DATA\n\nThis will OVERWRITE your current local data with the backup file.\nAre you sure you want to continue?";
    if(!confirm(msg)) return;
    document.getElementById('restoreFile').click();
}

// 3. Handle File Import
function handleRestore(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);

            // Validation
            if (!data.app || data.app !== "WaveAlpha" || !data.settings) {
                alert("❌ Invalid file! Please select a valid Wave Alpha backup file.");
                return;
            }

            // --- RESTORE PROCESS ---
            
            // 1. Update Global Variable
            if (typeof accSettings !== 'undefined') {
                accSettings = data.settings;
            }

            // 2. Save to LocalStorage
            localStorage.setItem('wave_settings', JSON.stringify(data.settings));
            
            // Optional: Restore Profile if exists
            if (data.profile) {
                localStorage.setItem('wave_profile', JSON.stringify(data.profile));
            }

            // 3. Sync to Cloud (Crucial Step)
            // This replaces the old "Sync Old Data" button
            if (typeof updateCloudWallets === 'function') {
                if(typeof showToast === 'function') showToast("⏳ Syncing to server...", "info");
                await updateCloudWallets(); // Push restored data to new Supabase
            } else if (typeof syncDataToCloud === 'function') {
                 // Fallback if function name is different
                 await syncDataToCloud();
            }

            alert("✅ Data restored successfully! The page will now reload.");
            window.location.reload();

        } catch (err) {
            console.error(err);
            alert("❌ Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = ''; // Reset input
}

// --- [ĐÃ SỬA TOÀN DIỆN] HÀM CẬP NHẬT GIAO DIỆN ĐỒNG BỘ ---
function updateSingleCardUI(rawRow) {
    // Thay vì chỉ cập nhật lẻ tẻ 1 thẻ (gây lỗi sót dữ liệu Daily Volume),
    // hàm này sẽ kích hoạt làm mới TOÀN BỘ giao diện để đảm bảo sự đồng nhất.

    // 1. Cập nhật số liệu trên các Thẻ bài (Card Grid)
    // Hàm này bên trong đã bao gồm lệnh vẽ lại bảng Market Health (Daily Volume)
    if (typeof updateGridValuesOnly === 'function') {
        updateGridValuesOnly();
    }

    // 2. Cập nhật bảng Market Health (Dự phòng để chắc chắn Daily Volume luôn mới)
    if (typeof renderMarketHealthTable === 'function' && document.getElementById('healthTableBody')) {
        renderMarketHealthTable();
    }
    
    // 3. Cập nhật thanh Thống kê trên cùng (Total Pool, Active Pools)
    if (typeof renderStats === 'function') {
        renderStats();
    }

    // 4. (Tính năng thêm) Nếu đang mở chi tiết Token này (Cockpit) -> Cập nhật luôn
    if (rawRow && typeof currentPolyId !== 'undefined' && currentPolyId && rawRow.id === parseInt(currentPolyId)) {
        if (typeof updateTerminalData === 'function') {
            updateTerminalData(currentPolyId);
        }
    }
}


    // --- HÀM GỬI BÁO CÁO TỔNG HỢP (ĐÃ SỬA LỖI ĐỌC DATA) ---
    async function broadcastDailyReport() {
        // 1. Hỏi xác nhận trước khi gửi
        if(!confirm("⚠️ XÁC NHẬN:\nTổng hợp dữ liệu ngày HÔM QUA và gửi lên Telegram?")) return;
        
        // 2. Hiển thị trạng thái đang xử lý
        showToast("⏳ Đang kết nối Server...", "info");
        const btn = document.getElementById('btn-broadcast');
        if(btn) { 
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; 
        }
    
        try {
            // 3. Gọi Function trên Supabase
            const { data, error } = await supabase.functions.invoke('daily-report');
            
            // 4. Kiểm tra lỗi kết nối (Mạng, Sai tên function, Thiếu Key)
            if (error) {
                console.error("Supabase Error:", error);
                alert("❌ LỖI KẾT NỐI SERVER:\n" + JSON.stringify(error, null, 2));
                throw error;
            }
    
            // 5. XỬ LÝ DỮ LIỆU (QUAN TRỌNG: Tránh lỗi Server trả về Text)
            let finalData = data;
            
            // Nếu Server trả về chuỗi văn bản (thường là thông báo lỗi HTML hoặc Text)
            if (typeof data === 'string') {
                console.log("Server trả về Text:", data);
                try {
                    // Cố gắng chuyển nó thành JSON
                    finalData = JSON.parse(data);
                } catch (parseError) {
                    // Nếu không chuyển được, nghĩa là Server báo lỗi nặng -> Hiện Alert để đọc
                    alert("⚠️ SERVER BÁO LỖI (TEXT):\n" + data);
                    throw new Error("Server trả về dữ liệu không hợp lệ (Non-JSON).");
                }
            }
    
            // 6. Kiểm tra kết quả logic
            if (finalData && finalData.success) {
                showToast(`✅ Đã gửi báo cáo (${finalData.count} tokens)!`, "success");
                alert(`✅ GỬI THÀNH CÔNG!\nĐã báo cáo ${finalData.count} token lên Telegram.`);
            } else {
                // Lấy thông báo lỗi từ server
                const msg = finalData ? (finalData.message || finalData.error) : "Dữ liệu rỗng";
                showToast("⚠️ SERVER TỪ CHỐI: " + msg, "error");
            }
    
        } catch (e) {
            console.error(e);
            showToast("❌ Lỗi: " + e.message, "error");
        } finally {
            // 7. Mở lại nút bấm
            if(btn) { 
                btn.disabled = false; 
                btn.innerHTML = '<i class="fas fa-bullhorn me-2"></i> GỬI BÁO CÁO TỔNG HỢP'; 
            }
        }
    }

// --- [NEW] HÀM HIỂN THỊ BANNER & HUB MỚI (FIX LỖI) ---
function renderCustomHub() {
    // 1. Xử lý Banner Slide
    const inner = document.querySelector('.carousel-inner');
    const indicators = document.querySelector('.carousel-indicators');
    
    // Kiểm tra xem có dữ liệu banner trong config không
    if (inner && siteConfig.banners && Array.isArray(siteConfig.banners) && siteConfig.banners.length > 0) {
        inner.innerHTML = ''; 
        indicators.innerHTML = '';
        
        siteConfig.banners.forEach((b, i) => {
            if(!b.img) return; // Bỏ qua nếu không có ảnh
            const active = i === 0 ? 'active' : '';
            
            // Tạo ảnh
            inner.innerHTML += `
                <div class="carousel-item ${active}" data-bs-interval="4000">
                    <a href="${b.link||'#'}" target="_blank">
                        <img src="${b.img}" class="d-block w-100" style="height: 180px; object-fit: cover;">
                    </a>
                </div>`;
                
            // Tạo nút chấm tròn
            indicators.innerHTML += `
                <button type="button" data-bs-target="#eventCarousel" data-bs-slide-to="${i}" class="${active}"></button>`;
        });
        const carousel = document.getElementById('eventCarousel');
        if(carousel) carousel.style.display = 'block';
    } else {
        // Nếu không có banner nào -> Ẩn khung slide đi
        const carousel = document.getElementById('eventCarousel');
        if(carousel) carousel.style.display = 'none';
    }

    // 2. Cập nhật Link 3 Sàn (Binance, Web3, Dex)
    if(siteConfig.ref_binance && document.getElementById('ui-ref-binance')) document.getElementById('ui-ref-binance').href = siteConfig.ref_binance;
    if(siteConfig.ref_web3 && document.getElementById('ui-ref-web3')) document.getElementById('ui-ref-web3').href = siteConfig.ref_web3;
    if(siteConfig.ref_dex && document.getElementById('ui-ref-dex')) document.getElementById('ui-ref-dex').href = siteConfig.ref_dex;
}
    // --- HÀM FIX LỖI CLICK VÀO BẢNG RA MÀN ĐEN ---
function jumpToCard(dbId) {
    // 1. Tìm thẻ bài tương ứng trong lưới Card
    const cardWrapper = document.querySelector(`.card-wrapper[data-id="${dbId}"]`);
    
    if (cardWrapper) {
        // 2. Lấy phần tử tour-card bên trong
        const card = cardWrapper.querySelector('.tour-card');
        
        // 3. Cuộn màn hình tới đó để user thấy
        cardWrapper.scrollIntoView({behavior: 'smooth', block: 'center'});
        
        // 4. Kích hoạt hiệu ứng phóng to thẻ bài
        // Đợi 1 xíu cho cuộn xong rồi mới phóng to cho mượt
        setTimeout(() => {
            toggleCardHighlight(card);
        }, 300);
    } else {
        // Nếu không tìm thấy thẻ (do đang lọc), thì mở Modal Update luôn
        openUpdateModal(dbId);
    }
}

// --- [BƯỚC 2] DÁN VÀO CUỐI FILE SCRIPT.JS ---
function updateHealthTableRealtime() {
    // Nếu bảng chưa mở thì thoát
    if (!document.getElementById('healthTableBody')) return;

    compList.forEach(c => {
        let dbId = c.db_id || c.id;

        // 1. CẬP NHẬT DAILY VOL (Đang chạy tốt)
        let dailyEl = document.getElementById(`vol-${dbId}`);
        if(dailyEl) {
             let dailyVal = parseFloat(c.real_alpha_volume || 0);
             let dailyText = '$' + parseInt(dailyVal).toLocaleString('en-US');
             if(dailyEl.innerText !== dailyText) {
                 dailyEl.innerText = dailyText;
                 dailyEl.style.color = '#fff'; // Nháy trắng nhẹ
                 setTimeout(() => dailyEl.style.color = '', 300);
             }
        }

        // 2. CẬP NHẬT TOTAL VOL (LẤY TRỰC TIẾP TỪ BIẾN MỚI HỨNG ĐƯỢC)
        let totalVal = parseFloat(c.total_accumulated_volume || 0);
        
        // Fallback: Nếu server chưa gửi về kịp thì mới tính tạm
        if (totalVal === 0) {
            let sDate = c.start || '2000-01-01';
            let todayStr = new Date().toISOString().split('T')[0];
            let histSum = (c.real_vol_history || []).reduce((s, i) => i.date >= sDate && i.date !== todayStr ? s + parseFloat(i.vol) : s, 0);
            totalVal = histSum + (c.real_alpha_volume || 0);
        }

        // Tìm đúng cái ID mh-total-... để điền số
        let totalEl = document.getElementById(`mh-total-${dbId}`);
        if (totalEl) {
            let newTotalText = '$' + parseInt(totalVal).toLocaleString('en-US');
            
            if (totalEl.innerText !== newTotalText) {
                totalEl.innerText = newTotalText;
                // Hiệu ứng nháy xanh báo hiệu
                totalEl.style.transition = 'none';
                totalEl.style.color = '#00F0FF';
                totalEl.style.textShadow = '0 0 10px #00F0FF';
                
                setTimeout(() => { 
                    totalEl.style.transition = 'color 0.5s ease';
                    totalEl.style.color = ''; 
                    totalEl.style.textShadow = ''; 
                }, 500);
            }
        }
    });
}



// --- SMART REFRESH: Chỉ tải lại khi người dùng quay lại Tab ---
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        console.log("👀 User is back! Checking for updates...");
        
        // Kiểm tra xem dữ liệu có quá cũ không (ví dụ > 5 phút chưa cập nhật)
        // Nếu muốn chắc ăn thì gọi luôn quickSyncData()
        quickSyncData(); 
        
        // Kiểm tra lại kết nối Realtime xem có bị đứt không
        const status = supabase.channel('public:tournaments').state;
        if (status !== 'joined' && status !== 'joining') {
            console.log("Reconnecting Realtime...");
            supabase.removeAllChannels();
            init(); // Gọi lại hàm khởi tạo để kết nối lại
        }
    }
});

/* --- FILE: script.js (Dán xuống cuối file) --- */

/* HÀM XỬ LÝ VOTE (Dùng LocalStorage để test) */
function handleVote(tokenId, type, btnElement) {
    // 1. Chặn sự kiện click lan ra ngoài (để không bị nhảy vào trang chi tiết)
    event.stopPropagation();

    // 2. Tìm dòng chứa nút bấm để xử lý UI
    let wrapper = btnElement.closest('.sentiment-wrapper');
    let btnUp = wrapper.querySelector('button:first-child');
    let btnDown = wrapper.querySelector('button:last-child');
    let barFill = wrapper.querySelector('.sentiment-fill-up');

    // 3. Xử lý Logic Toggle (Bấm lại nút đang chọn thì hủy vote)
    let currentVote = localStorage.getItem(`vote_${tokenId}`);
    
    // Reset UI trước
    btnUp.classList.remove('active-up');
    btnDown.classList.remove('active-down');

    if (currentVote === type) {
        // Nếu bấm lại nút cũ -> Hủy vote (Remove)
        localStorage.removeItem(`vote_${tokenId}`);
        // Trả thanh bar về trung bình
        barFill.style.width = '50%';
    } else {
        // Nếu bấm nút mới -> Lưu vote mới
        localStorage.setItem(`vote_${tokenId}`, type);
        
        // Cập nhật UI nút
        if (type === 'up') {
            btnUp.classList.add('active-up');
            barFill.style.width = '75%'; // Giả lập tăng
        } else {
            btnDown.classList.add('active-down');
            barFill.style.width = '25%'; // Giả lập giảm
        }
    }
    
    // (Sau này ta sẽ gọi API Supabase ở đây để lưu thật)
    console.log(`User voted ${type} for token ${tokenId}`);
}
