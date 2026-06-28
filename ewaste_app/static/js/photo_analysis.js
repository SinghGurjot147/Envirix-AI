/* ============================================================
   photo_analysis.js
   ----------------------------------------------------------
   NEW FILE — does not modify main.js, chatbot.js, or any
   existing script.

   Wires the ALREADY-BUILT dropzone (see index.html .dropzone /
   .preview-image-wrap / .processing-row, and main.js's existing
   drag/drop + local preview handler) to the new /photo-analysis
   endpoint, then renders the result using the EXISTING result
   card markup/classes from the #results section (.result-card,
   .score-card, .detail-panel, .insight-item) so no new layout
   or CSS framework is introduced — only photo_analysis_results.css
   adds a few result-only additions (action cards, damage tags).

   Everything here lives under the PhotoAnalysis namespace to
   avoid any collision with main.js's module-scoped variables
   (main.js wraps its own logic in a DOMContentLoaded closure, so
   there is no shared scope to collide with, but we namespace
   anyway for clarity and safety).

   INTEGRATION NOTE: add this script tag in index.html AFTER
   main.js (so the DOM and main.js's own dropzone preview/scan
   logic are already wired) and AFTER chatbot.js is unnecessary
   since this module does not depend on it:

       <script src="{{ url_for('static', filename='js/main.js') }}"></script>
       <script src="{{ url_for('static', filename='js/photo_analysis.js') }}" defer></script>
       <script src="{{ url_for('static', filename='js/chatbot.js') }}" defer></script>

   No existing <script> tag needs to change — this is a pure addition.
================================================================ */

const PhotoAnalysis = (() => {

  // ---- Config -------------------------------------------------------------
  const ENDPOINT = '/photo-analysis';
  const PREDICT_ENDPOINT = '/predict'; // existing ML endpoint, reused as-is

  // ---- State (module-scoped, not global) -----------------------------------
  let lastResult = null;
  let lastFile = null;

  // ---- Small DOM helpers ----------------------------------------------------
  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function show(el) {
    if (el) el.hidden = false;
  }

  function hide(el) {
    if (el) el.hidden = true;
  }

  // ---- Error banner (created once, reused) -----------------------------------
  // The existing dropzone markup has no dedicated error slot, so this
  // module injects one small, theme-consistent error element directly
  // after the dropzone the first time it's needed, rather than altering
  // index.html.
  function getOrCreateErrorBanner(dropzoneEl) {
    let banner = dropzoneEl.parentElement.querySelector('.photo-analysis-error');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'photo-analysis-error';
      banner.setAttribute('role', 'alert');
      banner.hidden = true;
      dropzoneEl.insertAdjacentElement('afterend', banner);
    }
    return banner;
  }

  function showError(dropzoneEl, message) {
    const banner = getOrCreateErrorBanner(dropzoneEl);
    banner.textContent = message;
    banner.hidden = false;
  }

  function clearError(dropzoneEl) {
    const banner = dropzoneEl.parentElement.querySelector('.photo-analysis-error');
    if (banner) banner.hidden = true;
  }

  // ---- Formatting helpers ------------------------------------------------

  function formatScore(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return Math.round(value) + '/100';
  }

  function formatYears(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return '--';
    return Number(value).toFixed(1) + ' yrs';
  }
function renderPhotoAnalysisResults(result) {

    const section = document.getElementById("photo-results");
    const container = document.getElementById("photo-results-container");

    section.hidden = false;

    const damages = (result.damages && result.damages.length)
        ? result.damages.map(d => `<span class="damage-tag">${d}</span>`).join("")
        : `<span class="damage-tag">No Visible Damage</span>`;

    container.innerHTML = `

<div class="photo-result-card">

    <div class="photo-result-header">

        <div class="photo-result-title">

            <h3>${result.device_type}</h3>

            <p>AI Visual Device Inspection Report</p>

        </div>

        <div class="photo-condition">

            ${result.condition}

        </div>

    </div>


    <div class="photo-metrics">

        <div class="metric-card">

            <h4>Health</h4>

            <span>${Math.round(result.health_score)}</span>

        </div>

        <div class="metric-card">

            <h4>Circular</h4>

            <span>${Math.round(result.circular_score)}</span>

        </div>

        <div class="metric-card">

            <h4>Life Left</h4>

            <span>${result.remaining_life}y</span>

        </div>

        <div class="metric-card">

            <h4>Confidence</h4>

            <span>${result.confidence}%</span>

        </div>

    </div>


    <div class="photo-section">

        <h4>Detected Damage</h4>

        <div class="damage-tags">

            ${damages}

        </div>

    </div>


    <div class="photo-recommendation">

        <h4>${result.recommendation}</h4>

        <p>${result.environmental_insight}</p>

    </div>

    <div class="photo-section">

    <h4>Recommended Platforms</h4>

    <div class="platform-grid">

        ${(result.action_cards?.platforms || []).map(platform => `

            <a
                href="${platform.url}"
                target="_blank"
                class="platform-card">

                <strong>${platform.name}</strong>

                <span>${platform.description}</span>

            </a>

        `).join("")}

    </div>

</div>

</div>

`;

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}

  function getOrCreateActionCardsContainer() {
    let container = byId('photo-action-cards');
    if (container) return container;

    const resultsDetail = document.querySelector('.results-detail');
    if (!resultsDetail) return null;

    container = document.createElement('div');
    container.id = 'photo-action-cards';
    container.className = 'photo-action-cards';
    resultsDetail.insertAdjacentElement('afterend', container);
    return container;
  }

  function renderActionCards(result) {
    const container = getOrCreateActionCardsContainer();
    if (!container) return;

    const { group, platforms } = result.action_cards || { group: null, platforms: [] };

    if (!group || !platforms || platforms.length === 0) {
      container.innerHTML = `
        <div class="action-cards-heading">Next step</div>
        <p class="action-cards-empty">This device is in good enough condition to keep using as-is — no sell, donate, or recycle action needed right now.</p>
      `;
      return;
    }

    const groupLabel = {
      sell: 'Where to sell',
      donate: 'Where to donate',
      recycle: 'Where to recycle',
    }[group] || 'Suggested next step';

    const cardsHtml = platforms.map(p => `
      <a class="action-card" href="${escapeAttr(p.url)}" target="_blank" rel="noopener noreferrer">
        <span class="action-card-logo" data-logo="${escapeAttr(p.logo)}" aria-hidden="true">${escapeHtml((p.name || '?').charAt(0))}</span>
        <span class="action-card-body">
          <span class="action-card-name">${escapeHtml(p.name)}</span>
          <span class="action-card-desc">${escapeHtml(p.description)}</span>
        </span>
      </a>
    `).join('');

    container.innerHTML = `
      <div class="action-cards-heading">${groupLabel}</div>
      <div class="action-cards-grid">${cardsHtml}</div>
    `;
  }

  // ---- Escaping helpers (avoid injecting unescaped model output as HTML) ----

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
  }

  // ---- Auto-forward detected condition into the existing /predict form ------
  // Per spec: "The user should NOT need to manually select the condition
  // after photo analysis." This pre-fills the existing analyze form's
  // device type + condition radio so the user can simply press
  // "Run Analysis" with everything but brand/specs already set, instead
  // of silently auto-submitting a form the user hasn't reviewed.

  function prefillAnalyzeForm(result) {
    const deviceTypeSelect = byId('device-type');
    if (deviceTypeSelect && result.device_type) {
      const matchingOption = Array.from(deviceTypeSelect.options)
        .find(opt => opt.value === result.device_type);
      if (matchingOption) {
        deviceTypeSelect.value = result.device_type;
        deviceTypeSelect.dispatchEvent(new Event('change'));
      }
    }

    if (result.app_condition) {
      const radio = document.querySelector(
        `input[name="condition"][value="${result.app_condition}"]`
      );
      if (radio) radio.checked = true;
    }
  }

  // ---- Processing row label override (reuses EXISTING element) --------------
  // main.js already toggles `.is-scanning` / sets `.processing-label` text
  // on file selection. We extend that same label during the real network
  // call instead of introducing a second spinner.

  function setProcessingLabel(dropzoneEl, text) {
    const label = dropzoneEl.querySelector('.processing-label');
    if (label) label.textContent = text;
  }

  // ---- Core: send the image to /photo-analysis -------------------------------

  async function analyzeFile(file, dropzoneEl) {
    if (!file) return;
    lastFile = file;
    clearError(dropzoneEl);
    setProcessingLabel(dropzoneEl, 'Analyzing device condition…');
    dropzoneEl.classList.add('is-scanning');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        showError(dropzoneEl, data.error || 'Something went wrong analyzing this photo.');
        setProcessingLabel(dropzoneEl, 'Analysis failed — try another photo');
        return;
      }

      lastResult = data;

setProcessingLabel(dropzoneEl, 'Analysis complete');

const processingRow = dropzoneEl.querySelector('.processing-row');

if (processingRow) {
    processingRow.style.display = "none";
}

renderPhotoAnalysisResults(data);

    } catch (err) {
      showError(dropzoneEl, 'Network error while analyzing the photo. Please try again.');
      setProcessingLabel(dropzoneEl, 'Analysis failed — try another photo');
    } finally {

    dropzoneEl.classList.remove('is-scanning');

    const processingRow = dropzoneEl.querySelector('.processing-row');

    if (processingRow) {
        processingRow.style.display = "none";
    }

}
  }

  // ---- Wire-up: attach to the EXISTING dropzone without touching main.js ----
  // main.js already attaches its own 'change' and 'drop' listeners to the
  // same elements for the local preview/scan-animation behavior. Adding a
  // second, independent listener here is safe — multiple listeners on the
  // same event are standard DOM behavior and do not conflict, since this
  // module never removes or replaces main.js's listeners.

  function init() {
    const dropzone = document.querySelector('.dropzone');
    if (!dropzone) return;

    const fileInput = dropzone.querySelector('input[type="file"]');

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      analyzeFile(file, dropzone);
    });

    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      analyzeFile(file, dropzone);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---- Public API -------------------------------------------------------
  // Exposed narrowly (not via global variables) so other modules — e.g. a
  // future EcoBot context hook — can read the last result without this
  // module leaking internal state onto `window` directly.
  return {
    getLastResult: () => lastResult,
    getLastFile: () => lastFile,
  };

})();
