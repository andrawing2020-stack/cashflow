import { useState, useEffect, useCallback } from "react";

const FIXED_INCOME = [
  { day: 1, label: "작업실 분담금", amount: 340000, fixed: true },
  { day: 21, label: "네이버 고료", amount: 2300000, fixed: true },
  { day: 21, label: "유료수익", amount: null, fixed: false },
  { day: 24, label: "전작 수익", amount: null, fixed: false },
];

const FIXED_EXPENSE = [
  { day: 10, label: "국민연금", amount: -300000, fixed: true },
  { day: 20, label: "아파트 관리비", amount: -200000, fixed: true, card: "현대카드" },
  { day: 22, label: "통신비", amount: -60000, fixed: true, card: "삼성카드" },
  { day: 22, label: "보험", amount: -200000, fixed: true, card: "삼성카드" },
  { day: 22, label: "건강보험", amount: -370000, fixed: true, card: "삼성카드" },
  { day: 25, label: "강아지 약값", amount: -200000, fixed: true, card: "일반계좌" },
  { day: 25, label: "어시비", amount: -1300000, fixed: true, card: "일반계좌" },
  { day: 25, label: "작업실 (월세+관리비+전기)", amount: -600000, fixed: true, card: "일반계좌" },
];

const EXPENSE_CATS = ["교통비", "외식비", "커피", "장보기", "여행", "그외"];
const INCOME_CATS = ["단타", "기타수입"];
const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const WEEKDAYS = ["일","월","화","수","목","금","토"];

/* ─── Storage helpers (localStorage) ─── */
const storageKey = (y, m) => `cf:${y}-${m}`;
const loadData = (key) => { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : {}; } catch { return {}; } };
const saveData = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };

const exportAllData = () => {
  const backup = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith("cf:")) backup[k] = JSON.parse(localStorage.getItem(k));
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  a.href = url;
  a.download = `cashflow-backup-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const importAllData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let count = 0;
        Object.entries(data).forEach(([k, v]) => {
          if (k.startsWith("cf:")) { localStorage.setItem(k, JSON.stringify(v)); count++; }
        });
        resolve(count);
      } catch { reject("파일 형식이 올바르지 않습니다"); }
    };
    reader.onerror = () => reject("파일을 읽을 수 없습니다");
    reader.readAsText(file);
  });
};

/* ─── Formatting ─── */
const fmt = (n) => {
  if (n == null) return "미입력";
  const abs = Math.abs(n);
  if (abs >= 10000) {
    const man = Math.floor(abs / 10000);
    const rest = abs % 10000;
    return (n < 0 ? "-" : "+") + man + "만" + (rest > 0 ? rest.toLocaleString() : "");
  }
  return (n < 0 ? "-" : "+") + abs.toLocaleString() + "원";
};

const fmtShort = (n) => {
  if (n == null) return "";
  const abs = Math.abs(n);
  if (abs >= 10000) {
    const man = (abs / 10000).toFixed(abs % 10000 === 0 ? 0 : 1);
    return (n < 0 ? "-" : "+") + man + "만";
  }
  return (n < 0 ? "-" : "+") + abs.toLocaleString();
};

/* ─── Calc month totals ─── */
const calcMonthTotals = (entries, monthDays) => {
  let inc = 0, exp = 0;
  for (let d = 1; d <= monthDays; d++) {
    FIXED_INCOME.forEach((fi) => {
      if (fi.day === d) {
        const override = entries[`fixed-income-${fi.label}`];
        const amt = override !== undefined ? override : fi.amount;
        if (amt > 0) inc += amt;
      }
    });
    FIXED_EXPENSE.forEach((fe) => { if (fe.day === d) exp += fe.amount; });
    (entries[`day-${d}`] || []).forEach((m) => {
      if (m.amount > 0) inc += m.amount;
      if (m.amount < 0) exp += m.amount;
    });
  }
  return { inc, exp, net: inc + exp };
};

/* ═══════════════════════════════════════
   Yearly View
   ═══════════════════════════════════════ */
function YearlyView({ year, setYear, onMonthClick, onDataImported }) {
  const [monthData, setMonthData] = useState({});
  const [showMenu, setShowMenu] = useState(false);
  const [importMsg, setImportMsg] = useState(null);

  const refreshData = useCallback(() => {
    const data = {};
    for (let m = 0; m < 12; m++) {
      const ent = loadData(storageKey(year, m));
      data[m] = calcMonthTotals(ent, new Date(year, m + 1, 0).getDate());
    }
    setMonthData(data);
  }, [year]);

  useEffect(() => { refreshData(); }, [refreshData]);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await importAllData(file);
      setImportMsg(`${count}개월 데이터 복원 완료!`);
      refreshData();
      if (onDataImported) onDataImported();
      setTimeout(() => setImportMsg(null), 2500);
    } catch (err) {
      setImportMsg(typeof err === "string" ? err : "복원 실패");
      setTimeout(() => setImportMsg(null), 2500);
    }
    e.target.value = "";
  };

  const yearTotal = Object.values(monthData).reduce((s, d) => s + (d?.net || 0), 0);
  const now = new Date();

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.monthNav}>
          <button onClick={() => setYear(year - 1)} style={S.navBtn}>{"\u2039"}</button>
          <span style={S.monthLabel}>{year}년</span>
          <button onClick={() => setYear(year + 1)} style={S.navBtn}>{"\u203A"}</button>
        </div>
        <button onClick={() => setShowMenu(!showMenu)} style={S.gearBtn}>{"\u2699"}</button>
      </div>

      {/* Settings menu */}
      {showMenu && (
        <div style={S.settingsMenu}>
          <button onClick={() => { exportAllData(); setShowMenu(false); }} style={S.settingsBtn}>
            <span style={S.settingsIcon}>{"\u2B07"}</span> 내보내기 (백업)
          </button>
          <label style={S.settingsBtn}>
            <span style={S.settingsIcon}>{"\u2B06"}</span> 불러오기 (복원)
            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
          </label>
        </div>
      )}

      {/* Import message */}
      {importMsg && (
        <div style={S.importMsg}>{importMsg}</div>
      )}

      <div style={{
        ...S.yearTotalBar,
        background: yearTotal >= 0
          ? "linear-gradient(135deg, #e8faf0, #d1fae5)"
          : "linear-gradient(135deg, #fef2f2, #fde8e8)",
      }}>
        <span style={S.yearTotalLabel}>연간 합산</span>
        <span style={{ ...S.yearTotalVal, color: yearTotal >= 0 ? "#16a34a" : "#e11d48" }}>
          {yearTotal >= 0 ? "+" : ""}{fmtShort(yearTotal)}
        </span>
      </div>

      <div style={S.yearGrid}>
        {Array.from({ length: 12 }, (_, m) => {
          const d = monthData[m] || { inc: 0, exp: 0, net: 0 };
          const isCurrent = year === now.getFullYear() && m === now.getMonth();
          return (
            <div key={m} onClick={() => onMonthClick(m)}
              style={{ ...S.yearCard, ...(isCurrent ? S.yearCardCurrent : {}) }}>
              <div style={S.yearCardMonth}>{MONTH_LABELS[m]}</div>
              <div style={{ ...S.yearCardNet, color: d.net >= 0 ? "#22c55e" : "#f43f5e" }}>
                {d.net >= 0 ? "+" : ""}{fmtShort(d.net)}
              </div>
              <div style={S.yearCardSub}>
                <span style={{ color: "#4ade80", fontSize: 10 }}>{fmtShort(d.inc)}</span>
                <span style={{ color: "#fb7185", fontSize: 10 }}>{fmtShort(d.exp)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Main App
   ═══════════════════════════════════════ */
export default function App() {
  const today = new Date();
  const [view, setView] = useState("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [entries, setEntries] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [showInput, setShowInput] = useState(false);
  const [inputType, setInputType] = useState("expense");
  const [inputCat, setInputCat] = useState(EXPENSE_CATS[0]);
  const [inputAmount, setInputAmount] = useState("");
  const [inputMemo, setInputMemo] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [editingFixed, setEditingFixed] = useState(null);
  const [editFixedAmount, setEditFixedAmount] = useState("");

  const key = storageKey(year, month);

  useEffect(() => {
    setEntries(loadData(key));
  }, [key]);

  const save = useCallback((data) => {
    setEntries(data);
    saveData(key, data);
  }, [key]);

  /* Year view */
  if (view === "year") {
    return <YearlyView year={year} setYear={setYear} onMonthClick={(m) => { setMonth(m); setView("month"); }} onDataImported={() => setEntries(loadData(key))} />;
  }

  /* Month view */
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const getItemsForDay = (d) => {
    const items = [];
    FIXED_INCOME.forEach((fi) => {
      if (fi.day === d) {
        const override = entries[`fixed-income-${fi.label}`];
        items.push({ ...fi, amount: override !== undefined ? override : fi.amount, type: "income", editable: !fi.fixed });
      }
    });
    FIXED_EXPENSE.forEach((fe) => { if (fe.day === d) items.push({ ...fe, type: "expense" }); });
    (entries[`day-${d}`] || []).forEach((m) => items.push(m));
    return items;
  };

  const hasIncome = (d) => getItemsForDay(d).some((i) => i.type === "income" && i.amount > 0);
  const hasExpense = (d) => getItemsForDay(d).some((i) => i.type === "expense" || (i.amount && i.amount < 0));

  let totalIncome = 0, totalExpense = 0;
  const catTotals = {};
  for (let d = 1; d <= daysInMonth; d++) {
    getItemsForDay(d).forEach((item) => {
      const amt = item.amount || 0;
      if (amt > 0) totalIncome += amt;
      if (amt < 0) totalExpense += amt;
      if (item.category) catTotals[item.category] = (catTotals[item.category] || 0) + amt;
    });
  }

  const prevMonth = () => { if (month === 0) { setYear(year - 1); setMonth(11); } else setMonth(month - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setYear(year + 1); setMonth(0); } else setMonth(month + 1); setSelectedDay(null); };

  const addManualEntry = () => {
    if (!inputAmount) return;
    const amt = parseInt(inputAmount) * 1000 * (inputType === "expense" ? -1 : 1);
    const newEntry = { label: inputMemo || inputCat, amount: amt, type: inputType, category: inputCat, manual: true };
    const dayKey = `day-${selectedDay}`;
    const updated = { ...entries, [dayKey]: [...(entries[dayKey] || []), newEntry] };
    save(updated);
    setShowInput(false); setInputAmount(""); setInputMemo("");
  };

  const deleteManualEntry = (dayNum, globalIdx) => {
    const dayKey = `day-${dayNum}`;
    const arr = [...(entries[dayKey] || [])]; arr.splice(globalIdx, 1);
    const updated = { ...entries };
    if (arr.length) updated[dayKey] = arr; else delete updated[dayKey];
    save(updated);
  };

  const saveFixedAmount = (label) => {
    if (!editFixedAmount && editFixedAmount !== "0") return;
    const amt = parseInt(editFixedAmount) * 10000;
    const updated = { ...entries, [`fixed-income-${label}`]: amt };
    save(updated);
    setEditingFixed(null); setEditFixedAmount("");
  };

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.monthNav}>
          <button onClick={prevMonth} style={S.navBtn}>{"\u2039"}</button>
          <button onClick={() => setView("year")} style={S.monthLabelBtn}>
            {year}년 {MONTH_LABELS[month]}
          </button>
          <button onClick={nextMonth} style={S.navBtn}>{"\u203A"}</button>
        </div>
      </div>

      {/* Balance */}
      <div style={S.balanceBar}>
        <div style={S.balanceItem}>
          <span style={S.balanceLabel}>수입</span>
          <span style={{ ...S.balanceVal, color: "#22c55e" }}>{fmtShort(totalIncome)}</span>
        </div>
        <div style={S.balanceDivider} />
        <div style={S.balanceItem}>
          <span style={S.balanceLabel}>지출</span>
          <span style={{ ...S.balanceVal, color: "#f43f5e" }}>{fmtShort(totalExpense)}</span>
        </div>
        <div style={S.balanceDivider} />
        <div style={S.balanceItem}>
          <span style={S.balanceLabel}>잔액</span>
          <span style={{ ...S.balanceVal, color: totalIncome + totalExpense >= 0 ? "#22c55e" : "#f43f5e" }}>
            {fmtShort(totalIncome + totalExpense)}
          </span>
        </div>
        <button onClick={() => setShowSummary(!showSummary)} style={S.summaryToggle}>
          {showSummary ? "\u2715" : "분류"}
        </button>
      </div>

      {/* Category Summary */}
      {showSummary && (
        <div style={S.catSummary}>
          {Object.entries(catTotals).length === 0 && <div style={S.catEmpty}>수동 입력 내역이 없습니다</div>}
          {Object.entries(catTotals).map(([cat, total]) => (
            <div key={cat} style={S.catRow}>
              <span style={S.catName}>{cat}</span>
              <span style={{ ...S.catVal, color: total >= 0 ? "#22c55e" : "#f43f5e" }}>{fmtShort(total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div style={S.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ ...S.weekCell, color: i === 0 ? "#f43f5e" : i === 6 ? "#3b82f6" : "#888" }}>{w}</div>
        ))}
      </div>
      <div style={S.grid}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} style={S.emptyCell} />;
          const inc = hasIncome(d);
          const exp = hasExpense(d);
          const sel = selectedDay === d;
          const dow = (firstDow + d - 1) % 7;
          return (
            <div key={d} onClick={() => setSelectedDay(sel ? null : d)}
              style={{ ...S.dayCell, ...(sel ? S.dayCellSel : {}), ...(isToday(d) ? S.todayCell : {}) }}>
              <span style={{
                ...S.dayNum,
                color: dow === 0 ? "#f43f5e" : dow === 6 ? "#3b82f6" : "#333",
                fontWeight: isToday(d) ? 700 : 400,
              }}>{d}</span>
              <div style={S.dotRow}>
                {inc && <div style={S.greenDot} />}
                {exp && <div style={S.pinkDot} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Day Detail */}
      {selectedDay && (
        <div style={S.detail}>
          <div style={S.detailHeader}>
            <span style={S.detailTitle}>{month + 1}월 {selectedDay}일</span>
            <button onClick={() => { setInputType("expense"); setInputCat(EXPENSE_CATS[0]); setShowInput(!showInput); }} style={S.addBtn}>+ 입력</button>
          </div>

          {getItemsForDay(selectedDay).length === 0 && !showInput && <div style={S.noItems}>내역이 없습니다</div>}

          {getItemsForDay(selectedDay).map((item, idx) => {
            const manualIdx = (() => { if (!item.manual) return -1; let c = -1; const all = getItemsForDay(selectedDay); for (let j = 0; j <= idx; j++) { if (all[j]?.manual) c++; } return c; })();
            return (
              <div key={idx} style={S.itemRow}>
                <div style={S.itemLeft}>
                  <div style={{ ...S.itemDot, background: item.type === "income" ? "#22c55e" : "#f43f5e" }} />
                  <div>
                    <div style={S.itemLabel}>
                      {item.label}
                      {item.card && <span style={S.cardBadge}>{item.card}</span>}
                      {item.category && <span style={S.catBadge}>{item.category}</span>}
                    </div>
                    {item.editable && !item.amount && editingFixed !== item.label && (
                      <button onClick={() => { setEditingFixed(item.label); setEditFixedAmount(""); }} style={S.enterAmountBtn}>금액 입력</button>
                    )}
                    {editingFixed === item.label && (
                      <div style={S.inlineEdit}>
                        <input type="number" inputMode="numeric" placeholder="만원 단위" value={editFixedAmount}
                          onChange={(e) => setEditFixedAmount(e.target.value)} style={S.inlineInput} autoFocus />
                        <button onClick={() => saveFixedAmount(item.label)} style={S.inlineSave}>확인</button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={S.itemRight}>
                  <span style={{ ...S.itemAmount, color: item.amount > 0 ? "#22c55e" : item.amount < 0 ? "#f43f5e" : "#aaa" }}>
                    {item.amount != null ? fmt(item.amount) : "미입력"}
                  </span>
                  {item.manual && <button onClick={() => deleteManualEntry(selectedDay, manualIdx)} style={S.delBtn}>{"\u2715"}</button>}
                  {item.editable && item.amount != null && (
                    <button onClick={() => { setEditingFixed(item.label); setEditFixedAmount(String(item.amount / 10000)); }} style={S.delBtn}>{"\u270E"}</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Manual Input */}
          {showInput && (
            <div style={S.inputForm}>
              <div style={S.typeToggle}>
                <button onClick={() => { setInputType("expense"); setInputCat(EXPENSE_CATS[0]); }}
                  style={inputType === "expense" ? S.typeActive : S.typeInactive}>지출</button>
                <button onClick={() => { setInputType("income"); setInputCat(INCOME_CATS[0]); }}
                  style={inputType === "income" ? { ...S.typeActive, background: "#22c55e" } : S.typeInactive}>수입</button>
              </div>
              <div style={S.catPicker}>
                {(inputType === "expense" ? EXPENSE_CATS : INCOME_CATS).map((c) => (
                  <button key={c} onClick={() => setInputCat(c)}
                    style={inputCat === c ? { ...S.catChip, background: inputType === "expense" ? "#f43f5e" : "#22c55e", color: "#fff", borderColor: "transparent" } : S.catChip}>{c}</button>
                ))}
              </div>
              <div style={S.inputRow}>
                <input type="number" inputMode="numeric" placeholder="천원 단위 (예: 5 = 5,000원)" value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)} style={S.amountInput} autoFocus />
              </div>
              <div style={S.inputRow}>
                <input type="text" placeholder="메모 (선택)" value={inputMemo}
                  onChange={(e) => setInputMemo(e.target.value)} style={S.memoInput} />
              </div>
              <div style={S.inputActions}>
                <button onClick={() => setShowInput(false)} style={S.cancelBtn}>취소</button>
                <button onClick={addManualEntry} style={{ ...S.saveBtn, background: inputType === "expense" ? "#f43f5e" : "#22c55e" }}>저장</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Styles — mobile-first
   ═══════════════════════════════════════ */
const S = {
  root: {
    fontFamily: "'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif",
    maxWidth: 460, margin: "0 auto",
    padding: "env(safe-area-inset-top, 12px) 10px calc(env(safe-area-inset-bottom, 20px) + 24px)",
    background: "#fafafa", minHeight: "100vh", minHeight: "100dvh",
    color: "#222", WebkitFontSmoothing: "antialiased",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 0 14px", position: "relative" },
  monthNav: { display: "flex", alignItems: "center", gap: 14 },
  navBtn: {
    background: "none", border: "1px solid #e0e0e0", fontSize: 22,
    cursor: "pointer", color: "#555", width: 38, height: 38,
    borderRadius: 10, display: "flex", alignItems: "center",
    justifyContent: "center", lineHeight: 1, fontFamily: "system-ui",
    WebkitTapHighlightColor: "transparent",
  },
  monthLabel: { fontSize: 19, fontWeight: 600, letterSpacing: -0.5 },
  monthLabelBtn: {
    fontSize: 19, fontWeight: 600, letterSpacing: -0.5,
    background: "none", border: "none", cursor: "pointer",
    color: "#222", padding: "6px 10px", borderRadius: 8,
    fontFamily: "'Noto Sans KR', sans-serif", borderBottom: "1px dashed #ccc",
    WebkitTapHighlightColor: "transparent",
  },
  gearBtn: {
    position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", fontSize: 22, color: "#999",
    cursor: "pointer", padding: 6, WebkitTapHighlightColor: "transparent",
  },
  settingsMenu: {
    background: "#fff", borderRadius: 12, padding: "6px",
    marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
    display: "flex", flexDirection: "column", gap: 2,
  },
  settingsBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "none", border: "none", padding: "12px 14px",
    fontSize: 14, color: "#333", cursor: "pointer", borderRadius: 8,
    fontFamily: "'Noto Sans KR', sans-serif",
    WebkitTapHighlightColor: "transparent",
  },
  settingsIcon: { fontSize: 16, width: 20, textAlign: "center" },
  importMsg: {
    background: "#22c55e", color: "#fff", borderRadius: 10,
    padding: "10px 16px", marginBottom: 10, fontSize: 13,
    fontWeight: 500, textAlign: "center",
  },

  // Year view
  yearTotalBar: { borderRadius: 14, padding: "16px 20px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" },
  yearTotalLabel: { fontSize: 14, fontWeight: 500, color: "#555" },
  yearTotalVal: { fontSize: 24, fontWeight: 700, letterSpacing: -0.5 },
  yearGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  yearCard: {
    background: "#fff", borderRadius: 14, padding: "14px 12px",
    cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    display: "flex", flexDirection: "column", gap: 4,
    WebkitTapHighlightColor: "transparent", transition: "transform 0.1s",
  },
  yearCardCurrent: { boxShadow: "inset 0 0 0 2px #3b82f6, 0 2px 8px rgba(59,130,246,0.15)" },
  yearCardMonth: { fontSize: 13, fontWeight: 600, color: "#555" },
  yearCardNet: { fontSize: 17, fontWeight: 700, letterSpacing: -0.3 },
  yearCardSub: { display: "flex", gap: 8, marginTop: 2 },

  // Balance
  balanceBar: { display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: 14, padding: "12px 12px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  balanceItem: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 2 },
  balanceLabel: { fontSize: 11, color: "#999", fontWeight: 400 },
  balanceVal: { fontSize: 15, fontWeight: 600, letterSpacing: -0.3 },
  balanceDivider: { width: 1, height: 28, background: "#e5e5e5" },
  summaryToggle: {
    background: "none", border: "1px solid #ddd", borderRadius: 8,
    fontSize: 11, color: "#777", padding: "6px 10px", cursor: "pointer",
    marginLeft: 6, whiteSpace: "nowrap",
    fontFamily: "'Noto Sans KR', sans-serif",
    WebkitTapHighlightColor: "transparent",
  },

  // Category
  catSummary: { background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  catEmpty: { fontSize: 12, color: "#bbb", textAlign: "center", padding: 8 },
  catRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" },
  catName: { fontSize: 13, color: "#555" },
  catVal: { fontSize: 13, fontWeight: 600 },

  // Calendar
  weekRow: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 2 },
  weekCell: { textAlign: "center", fontSize: 11, fontWeight: 500, padding: "4px 0" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 },
  emptyCell: { aspectRatio: "1" },
  dayCell: {
    aspectRatio: "1", borderRadius: 10, padding: 3,
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  dayCellSel: { background: "rgba(0,0,0,0.06)" },
  todayCell: { boxShadow: "inset 0 0 0 1.5px #3b82f6", borderRadius: 10 },
  dayNum: { fontSize: 13, lineHeight: 1 },
  dotRow: { display: "flex", gap: 3, marginTop: 3, minHeight: 7 },
  greenDot: { width: 7, height: 7, borderRadius: "50%", background: "#22c55e" },
  pinkDot: { width: 7, height: 7, borderRadius: "50%", background: "#f43f5e" },

  // Detail
  detail: { background: "#fff", borderRadius: 16, padding: "14px 16px", marginTop: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  detailTitle: { fontSize: 16, fontWeight: 600 },
  addBtn: {
    background: "#333", color: "#fff", border: "none", borderRadius: 8,
    padding: "7px 14px", fontSize: 13, cursor: "pointer",
    fontFamily: "'Noto Sans KR', sans-serif", fontWeight: 500,
    WebkitTapHighlightColor: "transparent",
  },
  noItems: { fontSize: 13, color: "#bbb", textAlign: "center", padding: 16 },
  itemRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f3f3" },
  itemLeft: { display: "flex", alignItems: "center", gap: 8, flex: 1 },
  itemDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  itemLabel: { fontSize: 13, fontWeight: 400, color: "#333" },
  cardBadge: { fontSize: 10, color: "#999", background: "#f3f3f3", borderRadius: 4, padding: "1px 5px", marginLeft: 5 },
  catBadge: { fontSize: 10, color: "#888", background: "#f0f7ff", borderRadius: 4, padding: "1px 5px", marginLeft: 5 },
  itemRight: { display: "flex", alignItems: "center", gap: 8 },
  itemAmount: { fontSize: 14, fontWeight: 600, letterSpacing: -0.3 },
  delBtn: {
    background: "none", border: "none", fontSize: 14, color: "#ccc",
    cursor: "pointer", padding: "4px 6px", minWidth: 28, minHeight: 28,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  enterAmountBtn: {
    background: "none", border: "1px dashed #ccc", borderRadius: 6,
    fontSize: 11, color: "#999", padding: "4px 10px", cursor: "pointer",
    marginTop: 2, fontFamily: "'Noto Sans KR', sans-serif",
  },
  inlineEdit: { display: "flex", gap: 4, marginTop: 4 },
  inlineInput: { width: 90, border: "1px solid #ddd", borderRadius: 6, padding: "5px 8px", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif" },
  inlineSave: { background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" },

  // Input form
  inputForm: { marginTop: 12, padding: 14, background: "#f8f8f8", borderRadius: 12 },
  typeToggle: { display: "flex", gap: 6, marginBottom: 10 },
  typeActive: { flex: 1, padding: "9px 0", border: "none", borderRadius: 8, background: "#f43f5e", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" },
  typeInactive: { flex: 1, padding: "9px 0", border: "1px solid #ddd", borderRadius: 8, background: "#fff", color: "#888", fontSize: 14, fontWeight: 400, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" },
  catPicker: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  catChip: { padding: "6px 12px", border: "1px solid #ddd", borderRadius: 16, background: "#fff", fontSize: 13, cursor: "pointer", color: "#555", fontFamily: "'Noto Sans KR', sans-serif" },
  inputRow: { marginBottom: 8 },
  amountInput: { width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: "'Noto Sans KR', sans-serif" },
  memoInput: { width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "'Noto Sans KR', sans-serif" },
  inputActions: { display: "flex", gap: 8, marginTop: 6 },
  cancelBtn: { flex: 1, padding: "10px 0", border: "1px solid #ddd", borderRadius: 8, background: "#fff", fontSize: 14, cursor: "pointer", color: "#888", fontFamily: "'Noto Sans KR', sans-serif" },
  saveBtn: { flex: 1, padding: "10px 0", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" },
};
