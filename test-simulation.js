/**
 * test-simulation.js
 * 模擬多個學生同時操作「地球日 × 六頂思考帽」系統
 *
 * 安裝：npm install firebase
 * 執行：node test-simulation.js
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';

// ── Firebase 設定（同 index.html）──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            'AIzaSyATDzAF9W9IPKlcY_l6efcRp0kzvg14ci4',
  authDomain:        'earth-day-six-thinking-hats.firebaseapp.com',
  projectId:         'earth-day-six-thinking-hats',
  storageBucket:     'earth-day-six-thinking-hats.firebasestorage.app',
  messagingSenderId: '932580651646',
  appId:             '1:932580651646:web:235ca3b955bec6ad589e2f',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── 行動資料（同 index.html ACTIONS）──────────────────────────────────────
const ACTION_01 = { n: 1,  t: '隨身攜帶購物袋、環保餐具及水杯', cat: '減塑力' };
const ACTION_13 = { n: 13, t: '落實正確資源回收和分類',           cat: '減塑力' };
const SELECTED_ACTIONS = [ACTION_01, ACTION_13];

const HAT_ORDER = ['white', 'red', 'yellow', 'black', 'green'];

const HAT_LABELS = {
  white:  '🤍 白帽',
  red:    '❤️  紅帽',
  yellow: '💛 黃帽',
  black:  '🖤 黑帽',
  green:  '💚 綠帽',
};

// ── ANSI 顏色工具 ──────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  blue:   '\x1b[34m',
  gray:   '\x1b[90m',
};
const bold   = s => `${C.bold}${s}${C.reset}`;
const green  = s => `${C.green}${s}${C.reset}`;
const yellow = s => `${C.yellow}${s}${C.reset}`;
const red    = s => `${C.red}${s}${C.reset}`;
const cyan   = s => `${C.cyan}${s}${C.reset}`;
const gray   = s => `${C.gray}${s}${C.reset}`;

// ── 帽子作答範本 ───────────────────────────────────────────────────────────
function hatAnswer(hatKey, seat, opts) {
  switch (hatKey) {
    case 'white':
      return {
        merged: [
          `【行動1：${ACTION_01.t}】`,
          `數字/事實：台灣每年使用約150億個塑膠袋（來源：環境部，2026/04/22）`,
          `環境影響：減少海洋塑膠污染，降低對海洋生態的衝擊`,
          '',
          `【行動2：${ACTION_13.t}】`,
          `數字/事實：台灣資源回收率約55%，仍有提升空間（來源：環境部，2026/04/22）`,
          `環境影響：減少垃圾焚燒量，降低CO₂排放`,
        ].join('\n'),
        raw: {
          a1fact:   `台灣每年使用約150億個塑膠袋（來源：環境部，2026/04/22）`,
          a1impact: `減少海洋塑膠污染，降低對海洋生態的衝擊`,
          a2fact:   `台灣資源回收率約55%，仍有提升空間（來源：環境部，2026/04/22）`,
          a2impact: `減少垃圾焚燒量，降低CO₂排放`,
        },
        note: '',
      };

    case 'red':
      if (opts.redPass) {
        return { merged: '（略過）', raw: null, note: yellow(' → 略過') };
      }
      return {
        merged: `行動01更有感覺，隨身帶環保餐具是我每天都能做到的小事，行動13也很重要但感覺比較被動。（座號${seat}）`,
        raw: null,
        note: '',
      };

    case 'yellow':
      if (opts.yellowPass) {
        return {
          merged: [
            `【行動1：${ACTION_01.t}】`,
            `（略過）`,
            '',
            `【行動2：${ACTION_13.t}】`,
            `（略過）`,
          ].join('\n'),
          raw: { a1: 'PASS', a2: 'PASS' },
          note: yellow(' → Pass（兩個欄位皆略過）'),
        };
      }
      return {
        merged: [
          `【行動1：${ACTION_01.t}】`,
          `對環境好，減少一次性垃圾，也讓自己養成好習慣（座號${seat}）`,
          '',
          `【行動2：${ACTION_13.t}】`,
          `能讓垃圾變資源，對地球更友善（座號${seat}）`,
        ].join('\n'),
        raw: {
          a1: `對環境好，減少一次性垃圾，也讓自己養成好習慣（座號${seat}）`,
          a2: `能讓垃圾變資源，對地球更友善（座號${seat}）`,
        },
        note: '',
      };

    case 'black':
      return {
        merged: `最難堅持的是行動01——每次外出都要記得帶環保餐具，臨時出門很容易忘記。此外行動13需要仔細分類，對初學者有學習門檻。（座號${seat}）`,
        raw: null,
        note: '',
      };

    case 'green':
      return {
        merged: `可以在書包固定放一個小袋裝環保餐具，設手機提醒；班上可以發起「帶杯挑戰」，用打卡方式互相激勵。回收方面可以製作分類圖貼在垃圾桶旁。（座號${seat}）`,
        raw: null,
        note: '',
      };
  }
}

// ── 模擬單一學生 ───────────────────────────────────────────────────────────
async function simulateStudent(cls, group, seat, opts = {}) {
  const docId = `${cls}-${group}-${seat}`;
  const ref   = doc(db, 'sessions', docId);
  const label = cyan(`[${cls}班第${group}組·座號${seat}]`);
  const log   = (msg) => console.log(`  ${label} ${msg}`);

  // 1. 登記
  await setDoc(ref, {
    cls, group, seat,
    selectedActions: [],
    hatIdx: 0,
    answers: {},
    finalAction: null,
    finalPlan: '',
    updatedAt: Date.now(),
  });
  log('登記完成');

  // 2. 選擇行動
  await setDoc(ref, { selectedActions: SELECTED_ACTIONS, updatedAt: Date.now() }, { merge: true });
  log('選擇行動：01 + 13');

  // 3. 依序完成白→紅→黃→黑→綠
  const answers = {};

  for (let i = 0; i < HAT_ORDER.length; i++) {
    const hatKey = HAT_ORDER[i];
    const { merged, raw, note } = hatAnswer(hatKey, seat, opts);

    answers[hatKey] = merged;
    if (raw) answers[`${hatKey}Raw`] = raw;

    await setDoc(
      ref,
      { answers: { ...answers }, hatIdx: i + 1, updatedAt: Date.now() },
      { merge: true },
    );
    log(`${HAT_LABELS[hatKey]} 儲存完成${note}`);
  }

  // 4. 藍帽統整
  const finalAction = opts.finalAction ?? ACTION_01;
  const finalPlan   = `我們打算${finalAction.t}，並在班上發起挑戰邀請同學加入。（座號${seat}發起）`;

  await setDoc(
    ref,
    { finalAction, finalPlan, hatIdx: 5, updatedAt: Date.now() },
    { merge: true },
  );
  log(`💙 藍帽完成 → 選擇 ${bold(`行動${finalAction.n}`)}：${finalAction.t.slice(0, 18)}…`);

  return { docId, cls, group, seat, answers, finalAction };
}

// ── 最終狀態摘要 ───────────────────────────────────────────────────────────
async function printFinalState(cls, group) {
  const q = query(
    collection(db, 'sessions'),
    where('cls',   '==', cls),
    where('group', '==', group),
  );
  const snap = await getDocs(q);
  const members = [];
  snap.forEach(d => members.push(d.data()));
  members.sort((a, b) => Number(a.seat) - Number(b.seat));

  console.log(bold(`\n  ┌─ 最終狀態：${cls}班第${group}組 ─────────────────────────`));
  for (const m of members) {
    const hatsDone = HAT_ORDER
      .filter(k => m.answers?.[k])
      .map(k => HAT_LABELS[k])
      .join(' ');
    const passFields = [];
    if (m.answers?.red    === '（略過）')             passFields.push('紅帽');
    if (m.answers?.yellowRaw?.a1 === 'PASS')          passFields.push('黃帽(a1)');
    if (m.answers?.yellowRaw?.a2 === 'PASS')          passFields.push('黃帽(a2)');
    const passNote = passFields.length ? yellow(` ⏭ Pass：${passFields.join('、')}`) : '';
    const actionNote = m.finalAction
      ? green(` ✅ 藍帽→行動${m.finalAction.n}`)
      : red(' ❌ 未完成藍帽');

    console.log(`  │  座號${m.seat}  hatIdx=${m.hatIdx}  ${hatsDone}${passNote}${actionNote}`);
  }
  console.log(`  └${'─'.repeat(52)}`);
}

// ── 藍帽一致性檢查 ─────────────────────────────────────────────────────────
async function checkBlueHatConsistency(cls, group) {
  const q = query(
    collection(db, 'sessions'),
    where('cls',   '==', cls),
    where('group', '==', group),
  );
  const snap = await getDocs(q);
  const members = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.finalAction) {
      members.push({ seat: data.seat, n: data.finalAction.n, t: data.finalAction.t });
    }
  });
  members.sort((a, b) => Number(a.seat) - Number(b.seat));

  const choiceMap = {};
  for (const m of members) {
    (choiceMap[m.n] = choiceMap[m.n] || []).push(m.seat);
  }
  const choiceCount = Object.keys(choiceMap).length;
  const isConsistent = choiceCount <= 1;

  console.log(bold(`\n  ┌─ 藍帽一致性檢查：${cls}班第${group}組 ────────────────────`));
  for (const m of members) {
    console.log(`  │  座號${m.seat}：行動${m.n}（${m.t}）`);
  }
  console.log('  │');
  if (isConsistent) {
    const n = Object.keys(choiceMap)[0];
    console.log(`  │  ${green('✅ 全組選擇一致')}：行動${n}，共 ${members.length} 人`);
  } else {
    console.log(`  │  ${red('⚠️  藍帽選擇不一致！')} 共 ${choiceCount} 種不同選擇，${bold('需要重填')}。`);
    for (const [n, seats] of Object.entries(choiceMap)) {
      console.log(`  │     行動${n}：${seats.map(s => `座號${s}`).join('、')}`);
    }
    console.log(`  │`);
    console.log(`  │  ${yellow('建議')}：請組長主持討論，重新在藍帽頁面達成共識。`);
  }
  console.log(`  └${'─'.repeat(52)}`);

  return isConsistent;
}

// ── 主程式 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log();
  console.log(bold('╔══════════════════════════════════════════════════════╗'));
  console.log(bold('║     地球日 × 六頂思考帽  —  模擬測試腳本               ║'));
  console.log(bold('╚══════════════════════════════════════════════════════╝'));
  console.log();

  // ── 情境一：704 第7組 ──────────────────────────────────────────────────
  console.log(bold(cyan('▶ 測試情境一：704班第7組')));
  console.log(gray('  座號1、3 正常填寫；座號2 黃帽選 Pass；藍帽三人一致選行動01'));
  console.log();

  await Promise.all([
    simulateStudent('704', '7', '1', {}),
    simulateStudent('704', '7', '2', { yellowPass: true }),
    simulateStudent('704', '7', '3', {}),
  ]);

  await printFinalState('704', '7');
  const g7ok = await checkBlueHatConsistency('704', '7');

  console.log();
  console.log('  ' + '─'.repeat(54));
  console.log();

  // ── 情境二：704 第8組 ──────────────────────────────────────────────────
  console.log(bold(cyan('▶ 測試情境二：704班第8組')));
  console.log(gray('  座號3 紅帽選 Pass；藍帽：座號1、2 選行動01，座號3 選行動13（不一致）'));
  console.log();

  await Promise.all([
    simulateStudent('704', '8', '1', { finalAction: ACTION_01 }),
    simulateStudent('704', '8', '2', { finalAction: ACTION_01 }),
    simulateStudent('704', '8', '3', { redPass: true, finalAction: ACTION_13 }),
  ]);

  await printFinalState('704', '8');
  const g8ok = await checkBlueHatConsistency('704', '8');

  // ── 總結 ───────────────────────────────────────────────────────────────
  console.log();
  console.log(bold('╔══════════════════════════════════════════════════════╗'));
  console.log(bold('║  測試結果摘要                                          ║'));
  console.log(bold('╠══════════════════════════════════════════════════════╣'));
  console.log(`║  情境一 (第7組) 藍帽一致性：${(g7ok ? green('✅ 通過') : red('❌ 失敗')).padEnd(30)}║`);
  console.log(`║  情境二 (第8組) 藍帽一致性：${(g8ok ? green('✅ 通過') : yellow('⚠️  偵測到不一致（符合預期）')).padEnd(30)}║`);
  console.log(bold('╚══════════════════════════════════════════════════════╝'));
  console.log();

  process.exit(0);
}

main().catch(err => {
  console.error(red('\n❌ 測試執行失敗：'), err.message);
  console.error(err);
  process.exit(1);
});
