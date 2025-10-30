const fs = require('fs');
const path = require('path');

const markdownFile = path.join(__dirname, '태창ERP_실무가이드.md');
const markdown = fs.readFileSync(markdownFile, 'utf-8');

// Screenshot mapping
const screenshots = {
  '[스크린샷: 로그인 화면]': '![로그인 화면](screenshots/01_login_page-2025-10-30T04-05-35-901Z.png)',
  '[스크린샷: 로그인 후 메인 대시보드]': '![메인 대시보드](screenshots/02_dashboard-2025-10-30T04-19-31-823Z.png)',
  '[스크린샷: 대시보드 전체 화면]': '![대시보드 전체 화면](screenshots/02_dashboard-2025-10-30T04-19-31-823Z.png)',
  '[스크린샷: 품목 관리 화면]': '![품목 관리 화면](screenshots/03_items_management-2025-10-30T04-21-00-419Z.png)',
  '[스크린샷: 품목 등록 화면]': '![품목 등록 화면](screenshots/03_items_management-2025-10-30T04-21-00-419Z.png)',
  '[스크린샷: 입고 처리 화면]': '![입고 처리 화면](screenshots/04_receiving-2025-10-30T04-21-25-838Z.png)',
  '[스크린샷: 입고 등록 폼]': '![입고 등록 폼](screenshots/04_receiving-2025-10-30T04-21-25-838Z.png)',
  '[스크린샷: 출고 처리 화면]': '![출고 처리 화면](screenshots/05_shipping-2025-10-30T04-22-14-587Z.png)',
  '[스크린샷: 출고 등록 폼]': '![출고 등록 폼](screenshots/05_shipping-2025-10-30T04-22-14-587Z.png)',
  '[스크린샷: 생산 처리 화면]': '![생산 처리 화면](screenshots/06_production-2025-10-30T04-22-27-770Z.png)',
  '[스크린샷: 생산 입고 폼]': '![생산 입고 폼](screenshots/06_production-2025-10-30T04-22-27-770Z.png)',
  '[스크린샷: 재고 현황 화면]': '![재고 현황 화면](screenshots/07_stock_status-2025-10-30T04-24-26-347Z.png)',
  '[스크린샷: 거래처 관리 화면]': '![거래처 관리 화면](screenshots/08_companies-2025-10-30T04-25-12-493Z.png)',
  '[스크린샷: 거래처 등록 폼]': '![거래처 등록 폼](screenshots/08_companies-2025-10-30T04-25-12-493Z.png)',
  '[스크린샷: BOM 관리 화면]': '![BOM 관리 화면](screenshots/09_bom-2025-10-30T04-27-28-930Z.png)',
  '[스크린샷: BOM 등록 화면]': '![BOM 등록 화면](screenshots/09_bom-2025-10-30T04-27-28-930Z.png)',
  '[스크린샷: 매출 관리 화면]': '![매출 관리 화면](screenshots/10_sales-2025-10-30T04-27-59-207Z.png)',
  '[스크린샷: 수금 관리 화면]': '![수금 관리 화면](screenshots/11_collections-2025-10-30T04-28-39-855Z.png)',
  '[스크린샷: 매입 관리 화면]': '![매입 관리 화면](screenshots/12_purchases-2025-10-30T04-28-53-997Z.png)',
  '[스크린샷: 지급 관리 화면]': '![지급 관리 화면](screenshots/13_payments-2025-10-30T04-30-02-037Z.png)',
  '[스크린샷: 월별 단가 관리 화면]': '![월별 단가 관리 화면](screenshots/14_monthly_prices-2025-10-30T04-38-15-223Z.png)',
  '[스크린샷: 회계 보고서 화면]': '![회계 보고서 화면](screenshots/15_accounting-2025-10-30T04-40-35-042Z.png)',
  '[스크린샷: 회계 요약]': '![회계 요약](screenshots/15_accounting-2025-10-30T04-40-35-042Z.png)'
};

// Replace all screenshot placeholders
let updatedMarkdown = markdown;
for (const [placeholder, image] of Object.entries(screenshots)) {
  updatedMarkdown = updatedMarkdown.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), image);
}

// Write updated markdown
fs.writeFileSync(markdownFile, updatedMarkdown, 'utf-8');

console.log('✓ Successfully updated Markdown with screenshot references');
console.log(`  Total replacements: ${Object.keys(screenshots).length}`);
console.log(`  File: ${markdownFile}`);
