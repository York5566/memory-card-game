import { FIELDS, elapsedText, toCSV, groupLabel } from './core.js';
import { escapeHTML as esc } from './stage.js';
import { toast, confirmAction } from './site.js';
export function openRecords(records, clear) {
  const dialog = document.querySelector('#records-dialog'); const prior = document.activeElement;
  function value(row, key) {
    const v = row.values[key]; if (v === null || v === undefined) return '未記錄';
    if (key === 'elapsedMs') return elapsedText(v);
    if (key === 'completedAt') return new Date(v).toLocaleString('zh-TW', { hour12: false });
    if (key === 'outcome') return v === 'won' ? '過關' : '時間到';
    if (key === 'accuracy') return v + '%'; return String(v);
  }
  function render() {
    const keys = Object.keys(FIELDS).filter(k => records.some(r => Object.hasOwn(r.values, k)));
    dialog.innerHTML = `<header class="dialog-header"><div><h2 id="records-title">成績紀錄</h2><p>僅儲存在此瀏覽器，不會加入本次排行榜。</p></div><button class="icon-button close-records" aria-label="關閉成績紀錄">×</button></header><div class="records-body"><div class="records-toolbar"><h3 style="margin:0">全部成績紀錄 <span class="muted">（${records.length} / 500 筆）</span></h3><div><button class="button small" id="records-export" ${records.length ? '' : 'disabled'}>下載 CSV</button><button class="button quiet small" id="records-clear">刪除全部成績紀錄</button></div></div>${records.length ? `<div class="records-table-wrap"><table><thead><tr>${keys.map(k => `<th scope="col">${FIELDS[k]}</th>`).join('')}<th scope="col">當時規則</th><th scope="col">成績識別碼</th></tr></thead><tbody>${[...records].reverse().map(row => `<tr>${keys.map(k => `<td title="${esc(value(row, k))}">${esc(value(row, k))}</td>`).join('')}<td><details><summary>${esc(groupLabel(row.rule))}</summary><p class="record-detail">失敗停留 ${row.rule.mismatchMs} 毫秒</p><p class="record-detail">完整組別識別碼：${esc(row.groupId)}</p></details></td><td>${esc(row.id)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><span aria-hidden="true">▤</span><p>還沒有保存的成績</p><small>在設定的「成績」分頁開啟保存，完成下一局後就會記錄。</small></div>'}<p class="hint">可在設定中選擇保存欄位。關閉成績紀錄不會刪除既有明細；此處只有明細與匯出，沒有歷史累計排名。</p><p id="records-status" class="save-status" role="status"></p></div>`;
    const close = () => { dialog.close(); prior?.focus(); };
    dialog.querySelector('.close-records').onclick = close; dialog.oncancel = event => { event.preventDefault(); close(); };
    dialog.querySelector('#records-export').onclick = () => {
      try {
        const blob = new Blob([toCSV(records)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
        const date = new Date(); const localDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
        a.href = url; a.download = `翻牌遊戲_成績紀錄_${localDate}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
        dialog.querySelector('#records-status').textContent = 'CSV 已準備下載，請查看瀏覽器下載清單。'; toast('CSV 已準備下載');
      } catch { dialog.querySelector('#records-status').textContent = '無法建立 CSV 下載，請檢查瀏覽器下載權限後再試一次。'; }
    };
    dialog.querySelector('#records-clear').onclick = async () => {
      if (!await confirmAction('刪除全部成績紀錄？', '此瀏覽器的全部成績紀錄將刪除，無法復原。建議先下載 CSV。設定與本次排行榜會保留。', '刪除紀錄')) return;
      if (clear()) { records = []; render(); dialog.querySelector('#records-status').textContent = '全部成績紀錄已刪除。'; } else dialog.querySelector('#records-status').textContent = '刪除失敗，成績紀錄已保留。';
    };
  }
  render(); dialog.showModal(); dialog.querySelector('.close-records').focus();
}
