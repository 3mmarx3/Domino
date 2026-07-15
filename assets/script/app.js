const STORAGE_KEY = 'domino_game_state';

function saveGameState() {
  try {
    const state = { target, players, roundCount, rounds: roundsHistory };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Could not save game state:', err);
  }
}

function clearGameState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {}
}

function tryResumeGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.players) || data.players.length === 0) return;

    target = data.target;
    players = data.players;
    roundCount = data.roundCount || 0;
    roundsHistory = Array.isArray(data.rounds) ? data.rounds : [];
    currentMode = players.length;

    document.getElementById('wizardWrap').classList.add('hidden-view');
    document.getElementById('gameView').classList.remove('hidden-view');
    document.getElementById('gameView').classList.add('rise-in');

    buildBoardStructure();
    rebuildHistoryFromState();
    highlightLeader();

    document.getElementById('resumeBanner').classList.remove('hidden-view');
  } catch (err) {
    console.log('No saved match to resume:', err);
  }
}

function dismissResumeBanner() {
  document.getElementById('resumeBanner').classList.add('hidden-view');
}

let currentStep = 1;
let target = 0;
let selectedPreset = null;
let currentMode = 2;

let players = [];
let roundCount = 0;
let roundsHistory = [];

const PIP_PATTERNS = {
  0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8], 6: [0, 1, 2, 6, 7, 8], 7: [0, 1, 2, 4, 6, 7, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8]
};

function pipGridHtml(digit) {
  const pattern = PIP_PATTERNS[digit] ?? [];
  let cells = '';
  for (let i = 0; i < 9; i++) {
    cells += `<div class="pip ${pattern.includes(i) ? 'on' : ''}"></div>`;
  }
  return `<div class="pip-grid" style="width:34px;height:34px;">${cells}</div>`;
}

function choosePreset(preset) {
  selectedPreset = preset;

  document.querySelectorAll('#presetGrid .option-tile').forEach(el => {
    el.classList.toggle('selected', String(el.dataset.preset) === String(preset));
  });

  const customWrap = document.getElementById('customTargetWrap');
  const nextBtn = document.getElementById('step1Next');

  if (preset === 'custom') {
    customWrap.classList.remove('hidden-view');
    customWrap.classList.add('pop-in');
    target = parseInt(document.getElementById('customTargetInput').value) || 0;
  } else {
    customWrap.classList.add('hidden-view');
    target = preset;
  }

  updateTargetPreview();
  nextBtn.disabled = !(target > 0);
}

function onCustomTargetInput() {
  target = parseInt(document.getElementById('customTargetInput').value) || 0;
  updateTargetPreview();
  document.getElementById('step1Next').disabled = !(target > 0);
}

function updateTargetPreview() {
  document.getElementById('targetPreview').innerText = target > 0 ? target : '—';
}

function chooseMode(mode) {
  currentMode = mode;
  document.querySelectorAll('[data-mode]').forEach(el => {
    el.classList.toggle('selected', parseInt(el.dataset.mode) === mode);
  });
  generateNameInputs();
}

function generateNameInputs() {
  const container = document.getElementById('namesContainer');
  container.innerHTML = '';
  for (let i = 1; i <= currentMode; i++) {
    container.innerHTML += `
      <div class="pop-in" style="animation-delay:${(i - 1) * 60}ms;">
        <label class="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-2">
          <i class="fa-solid fa-user text-[var(--gold)]"></i>
          ${currentMode === 2 ? `Player / Team ${i}` : `Player ${i}`}
        </label>
        <input type="text" id="playerName${i}" class="input-field" placeholder="Name ${i}">
      </div>`;
  }
}

function prepareReview() {
  document.getElementById('reviewTarget').innerText = target;

  const reviewPlayers = document.getElementById('reviewPlayers');
  reviewPlayers.innerHTML = '';
  for (let i = 1; i <= currentMode; i++) {
    const raw = document.getElementById(`playerName${i}`).value.trim();
    const name = raw || `Player ${i}`;
    reviewPlayers.innerHTML += `
      <div class="flex items-center justify-between bg-[var(--surface-2)] rounded-lg px-4 py-3">
        <span class="text-sm flex items-center gap-2"><i class="fa-solid fa-user text-[var(--gold)] text-xs"></i> ${escapeHtml(name)}</span>
        <span class="font-mono text-xs text-[var(--text-dim)]">0 PTS</span>
      </div>`;
  }
}

function goToStep(step) {
  if (currentStep === 1 && step > 1 && !(target > 0)) return;

  currentStep = step;
  const track = document.getElementById('wizardTrack');
  track.style.transform = `translateX(-${(step - 1) * 100}%)`;
  updateStepper();
}

function updateStepper() {
  document.querySelectorAll('.step-dot').forEach(dot => {
    const n = parseInt(dot.dataset.step);
    dot.classList.toggle('active', n === currentStep);
    dot.classList.toggle('done', n < currentStep);
    dot.innerHTML = n < currentStep ? '<i class="fa-solid fa-check"></i>' : n;
  });
  document.querySelectorAll('.step-line').forEach(line => {
    const n = parseInt(line.dataset.line);
    line.classList.toggle('done', n < currentStep);
  });
}

function startGame() {
  players = [];
  for (let i = 1; i <= currentMode; i++) {
    const raw = document.getElementById(`playerName${i}`).value.trim();
    players.push({ id: i, name: raw || `Player ${i}`, total: 0 });
  }
  roundCount = 0;
  roundsHistory = [];

  buildBoardStructure();
  document.getElementById('emptyHistory').classList.remove('hidden-view');
  document.getElementById('wizardWrap').classList.add('hidden-view');
  document.getElementById('gameView').classList.remove('hidden-view');
  document.getElementById('gameView').classList.add('rise-in');

  saveGameState();
}

function buildBoardStructure() {
  document.getElementById('targetPill').innerHTML = `<i class="fa-solid fa-bullseye"></i> ${target}`;

  const scoresGrid = document.getElementById('scoresGrid');
  const inputsGrid = document.getElementById('inputsGrid');
  const tableHeaders = document.getElementById('tableHeaders');
  const historyBody = document.getElementById('historyTableBody');

  scoresGrid.innerHTML = '';
  inputsGrid.innerHTML = '';
  tableHeaders.innerHTML = '<th>Round</th>';
  historyBody.innerHTML = '';

  scoresGrid.style.gridTemplateColumns = `repeat(${players.length}, minmax(0,1fr))`;
  inputsGrid.style.gridTemplateColumns = `repeat(${players.length}, minmax(0,1fr))`;

  players.forEach((player, idx) => {
    scoresGrid.innerHTML += `
      <div class="tile-card p-5 rise-in" id="card${player.id}" style="animation-delay:${idx * 60}ms;">
        <div class="text-xs uppercase tracking-wider text-[var(--text-dim)] font-semibold mb-3 truncate flex items-center gap-1">
          <i class="fa-solid fa-user text-[var(--gold)] text-[10px]"></i> ${escapeHtml(player.name)}
        </div>
        <div class="tile-seam mb-3"></div>
        <div class="flex items-end justify-between">
          <div id="total${player.id}" class="font-mono text-3xl md:text-4xl font-bold text-[var(--ivory)]">${player.total}</div>
          <div id="pip${player.id}">${pipGridHtml(player.total % 10)}</div>
        </div>
      </div>`;

    inputsGrid.innerHTML += `
      <input type="number" id="roundInput${player.id}" class="input-field font-mono text-center"
        placeholder="${escapeHtml(player.name)}">`;

    tableHeaders.innerHTML += `<th>${escapeHtml(player.name)}</th>`;
  });
}

function rebuildHistoryFromState() {
  const historyBody = document.getElementById('historyTableBody');
  const emptyHistory = document.getElementById('emptyHistory');

  if (roundsHistory.length === 0) {
    emptyHistory.classList.remove('hidden-view');
    return;
  }
  emptyHistory.classList.add('hidden-view');

  roundsHistory.forEach((round, i) => {
    let rowHtml = `<tr><td>${i + 1}</td>`;
    round.scores.forEach(score => { rowHtml += `<td>${score}</td>`; });
    rowHtml += `</tr>`;
    historyBody.insertAdjacentHTML('beforeend', rowHtml);
  });
}

function addRound() {
  let hasInput = false;
  const roundScores = [];

  players.forEach(player => {
    const val = parseInt(document.getElementById(`roundInput${player.id}`).value) || 0;
    roundScores.push(val);
    if (val > 0) hasInput = true;
  });

  if (!hasInput) {
    showModal({
      type: 'warn',
      title: 'Nothing to record',
      body: 'Enter at least one score before adding the round.',
      actions: [{ label: 'Got it', icon: 'fa-check', style: 'btn-gold', onClick: closeModal }]
    });
    return;
  }

  roundCount++;
  roundsHistory.push({ scores: roundScores });

  let rowHtml = `<tr class="row-in"><td>${roundCount}</td>`;

  players.forEach((player, index) => {
    const score = roundScores[index];
    player.total += score;

    const totalEl = document.getElementById(`total${player.id}`);
    totalEl.innerText = player.total;
    totalEl.classList.remove('flash');
    void totalEl.offsetWidth;
    totalEl.classList.add('flash');

    document.getElementById(`pip${player.id}`).innerHTML = pipGridHtml(player.total % 10);
    document.getElementById(`roundInput${player.id}`).value = '';
    rowHtml += `<td>${score}</td>`;
  });

  rowHtml += `</tr>`;
  document.getElementById('emptyHistory').classList.add('hidden-view');
  document.getElementById('historyTableBody').insertAdjacentHTML('beforeend', rowHtml);

  highlightLeader();
  checkWinner();
  saveGameState();
}

function highlightLeader() {
  if (players.length < 2) return;
  const maxTotal = Math.max(...players.map(p => p.total));
  players.forEach(p => {
    const card = document.getElementById(`card${p.id}`);
    if (!card.classList.contains('is-winner')) {
      card.classList.toggle('is-leader', p.total === maxTotal && maxTotal > 0);
    }
  });
}

function checkWinner() {
  const winners = players.filter(p => p.total >= target);
  if (winners.length === 0) return;

  winners.sort((a, b) => b.total - a.total);
  const topScore = winners[0].total;
  const topWinners = winners.filter(p => p.total === topScore);

  setTimeout(() => {
    if (topWinners.length === 1) {
      const winner = topWinners[0];
      const card = document.getElementById(`card${winner.id}`);
      card.classList.remove('is-leader');
      card.classList.add('is-winner');

      launchConfetti();

      showModal({
        type: 'win',
        title: 'Match won!',
        body: `${winner.name} reached ${winner.total} points and takes the match.`,
        actions: [
          { label: 'New Match', icon: 'fa-dice', style: 'btn-gold', onClick: () => { closeModal(); resetGame(); } },
          { label: 'Keep Viewing', icon: 'fa-eye', style: 'btn-outline', onClick: closeModal }
        ]
      });
    } else {
      const names = topWinners.map(w => w.name).join(' & ');
      showModal({
        type: 'warn',
        title: "It's a tie!",
        body: `${names} are tied at ${topScore} points. Play a tie-breaker round.`,
        actions: [{ label: 'Continue', icon: 'fa-arrow-right', style: 'btn-gold', onClick: closeModal }]
      });
    }
  }, 150);
}

function launchConfetti() {
  const colors = ['#c9a24b', '#f2ede2', '#b8342f', '#e8d5a0'];
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.zIndex = '70';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);

  const pieceCount = 90;
  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDuration = `${2.2 + Math.random() * 1.6}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 4500);
}

function askResetGame() {
  showModal({
    type: 'danger',
    title: 'Reset this match?',
    body: 'This clears all saved scores and round history, and takes you back to setup.',
    actions: [
      { label: 'Reset', icon: 'fa-trash', style: 'btn-ghost-red', onClick: () => { closeModal(); resetGame(); } },
      { label: 'Cancel', icon: 'fa-xmark', style: 'btn-outline', onClick: closeModal }
    ]
  });
}

function resetGame() {
  players = [];
  roundCount = 0;
  roundsHistory = [];
  target = 0;
  selectedPreset = null;
  currentMode = 2;
  currentStep = 1;

  document.getElementById('historyTableBody').innerHTML = '';
  document.getElementById('gameView').classList.add('hidden-view');
  document.getElementById('wizardWrap').classList.remove('hidden-view');
  document.getElementById('wizardWrap').classList.add('rise-in');
  dismissResumeBanner();

  document.querySelectorAll('#presetGrid .option-tile').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('[data-mode]').forEach(el => el.classList.remove('selected'));
  document.getElementById('customTargetWrap').classList.add('hidden-view');
  document.getElementById('customTargetInput').value = '';
  document.getElementById('targetPreview').innerText = '—';
  document.getElementById('step1Next').disabled = true;
  document.getElementById('namesContainer').innerHTML = '';
  goToStep(1);

  clearGameState();
}

function showModal({ type, title, body, actions }) {
  const backdrop = document.getElementById('modalBackdrop');
  const card = document.getElementById('modalCard');
  const icon = document.getElementById('modalIcon');
  const iconStyles = {
    win:    { bg: 'var(--gold-soft)', glyph: 'fa-trophy', color: 'var(--gold)' },
    warn:   { bg: 'var(--gold-soft)', glyph: 'fa-triangle-exclamation', color: 'var(--gold)' },
    danger: { bg: 'var(--red-soft)',  glyph: 'fa-trash', color: 'var(--red)' }
  };
  const s = iconStyles[type] || iconStyles.warn;

  icon.style.background = s.bg;
  icon.style.color = s.color;
  icon.style.fontSize = '22px';
  icon.innerHTML = `<i class="fa-solid ${s.glyph}"></i>`;
  icon.classList.toggle('trophy-bounce', type === 'win');

  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalBody').innerText = body;

  const actionsEl = document.getElementById('modalActions');
  actionsEl.innerHTML = '';
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = `btn ${a.style}`;
    btn.style.width = 'auto';
    btn.style.flex = '1';
    btn.innerHTML = `<i class="fa-solid ${a.icon}"></i> ${a.label}`;
    btn.onclick = a.onClick;
    actionsEl.appendChild(btn);
  });

  backdrop.classList.remove('hidden-view');
  backdrop.classList.add('backdrop-in');
  card.classList.remove('tile-flip');
  void card.offsetWidth;
  card.classList.add('tile-flip');
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.add('hidden-view');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.innerText = str;
  return div.innerHTML;
}

window.onload = () => {
  chooseMode(2);
  document.querySelector('[data-mode="2"]').classList.add('selected');
  updateStepper();
  tryResumeGame();
};
