/**
 * State manager responsible for:
 * - Tracking current service states
 * - Detecting state transitions
 * - Persisting alert state to disk
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../../data/state.json');

let stateMap = {};


/**
 * Load the saved state from disk on startup.
 */
function loadState() {
  try {

    if (!fs.existsSync(STATE_FILE)) {
      stateMap = {};
      return;
    }

    const raw = fs.readFileSync(STATE_FILE, 'utf8');

    if (!raw.trim()) {
      stateMap = {};
      return;
    }

    stateMap = JSON.parse(raw);

    console.log('State loaded from disk.');

  } catch (err) {

    console.error('State corrupted. Resetting...');

    stateMap = {};
    saveState();
  }
}


/**
 * Persist the state map to disk.
 */
function saveState() {
  try {

    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(stateMap, null, 2)
    );

  } catch (err) {

    console.error('Error saving state:', err.message);
  }
}


/**
 * Build a unique key for each monitored service.
 * Format: source|host|service
 */
function buildKey(service) {

  const source = (service.source || '').trim().toLowerCase();
  const host = (service.host_name || '').trim();
  const svc = (service.service_description || '').trim();

  return `${source}|${host}|${svc}`;
}

/**
 * Evaluates the current service state against the previously stored state.
 * 
 * Detects:
 * - new problems (WARNING / CRITICAL)
 * - state changes
 * - recoveries (return to OK)
 * 
 * Updates the internal state map and returns the state object when
 * further processing (alerts or recovery messages) may be required.
 */
function evaluateService(service) {

  const key = buildKey(service);
  const currentState = service.current_state;
  const acknowledged = service.problem_has_been_acknowledged === '1';

  const existing = stateMap[key];

  // Service enters a problem state
  if (!existing && currentState !== '0') {

    stateMap[key] = {
      state: currentState,
      lastMessage: 0,
      lastCall: 0,
      acknowledged,
      key,
      recovered: false
    };

    saveState();
    return stateMap[key];
  }

  // Service OK with no previous state
  if (!existing && currentState === '0') {
    return null;
  }

  // State change detected
  if (existing && existing.state !== currentState) {

    // Recovery
    if (currentState === '0') {

      const recoveryData = {
        ...existing,
        state: '0',
        recovered: true
      };

      delete stateMap[key];
      saveState();

      return recoveryData;
    }

    // WARNING ↔ CRITICAL change
    existing.state = currentState;
    existing.acknowledged = acknowledged;

    saveState();
    return existing;
  }

  // State remains the same
  if (existing) {
    existing.acknowledged = acknowledged;
    existing.recovered = false;
    return existing;
  }

  return null;
}


/**
 * Update the timestamp of the last message alert.
 */
function updateMessageTimestamp(key) {

  if (stateMap[key]) {

    stateMap[key].lastMessage = Date.now();
    saveState();
  }
}


/**
 * Update the timestamp of the last call alert.
 */
function updateCallTimestamp(key) {

  if (stateMap[key]) {

    stateMap[key].lastCall = Date.now();
    saveState();
  }
}


/**
 * Load persisted state when the module is initialized.
 */
loadState();


module.exports = {
  evaluateService,
  updateMessageTimestamp,
  updateCallTimestamp
};