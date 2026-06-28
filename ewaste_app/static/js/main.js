// ============================================
// E-WASTE DEVICE ANALYZER — interactions
// ============================================

document.addEventListener('DOMContentLoaded', () => {

const smartphoneBrands = [
    "Apple",
    "Samsung",
    "OnePlus",
    "Vivo",
    "Realme",
    "Motorola",
    "Google",
    "Xiaomi",
    "Oppo"
];

const tabletBrands = [
    "Apple",
    "Samsung",
    "Lenovo",
    "Xiaomi",
    "Huawei"
];

const laptopBrands = [
    "HP",
    "Dell",
    "Lenovo",
    "Asus",
    "Acer",
    "Apple",
    "MSI"
];

  /* ---- Sticky header scroll state ---- */
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (window.scrollY > 12) header.classList.add('scrolled');
    else header.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ---- */
  const menuToggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const mobileOverlay = document.querySelector('.mobile-overlay');
  const mobileClose = document.querySelector('.mobile-close');

  function openMenu() {
    mobileMenu.classList.add('open');
    mobileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileMenu.classList.remove('open');
    mobileOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  menuToggle?.addEventListener('click', openMenu);
  mobileClose?.addEventListener('click', closeMenu);
  mobileOverlay?.addEventListener('click', closeMenu);
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  /* ---- Active nav link on scroll ---- */
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a');
  const sections = Array.from(navLinks)
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  const setActive = () => {
    let current = sections[0];
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= 140) current = sec;
    });
    navLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
    });
  };
  window.addEventListener('scroll', setActive, { passive: true });
  setActive();

  /* ---- Smooth scroll for feature cards + nav ---- */
  document.querySelectorAll('a[href^="#"], [data-scroll-to]').forEach(el => {
    el.addEventListener('click', (e) => {
      const targetSel = el.getAttribute('href') || el.getAttribute('data-scroll-to');
      if (!targetSel || targetSel === '#') return;
      const target = document.querySelector(targetSel);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ---- Scroll reveal ---- */
  const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ---- In-view trigger for bars/gauges (separate, no removal of class needed) ---- */
  const inViewEls = document.querySelectorAll('.material-row, .widget, .gauge-svg');
  const inViewObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      }
    });
  }, { threshold: 0.3 });
  inViewEls.forEach(el => inViewObserver.observe(el));

  /* ---- Floating labels for selects (need has-value class) ---- */
  document.querySelectorAll('.field select').forEach(sel => {
    const sync = () => sel.classList.toggle('has-value', !!sel.value);
    sel.addEventListener('change', sync);
    sync();
  });

  /* ---- Condition cards ---- */
  document.querySelectorAll('.condition-grid').forEach(grid => {
    const cards = grid.querySelectorAll('.condition-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('is-checked'));
        card.classList.add('is-checked');
        card.querySelector('input').checked = true;
      });
    });
  });
const deviceType = document.getElementById("device-type");
const brandSelect = document.getElementById("device-brand");

function updateBrands() {

    if (!deviceType || !brandSelect) return;

    let brands = [];

    if (deviceType.value === "Smartphone") {
        brands = smartphoneBrands;
    }
    else if (deviceType.value === "Tablet") {
        brands = tabletBrands;
    }
    else if (deviceType.value === "Laptop") {
        brands = laptopBrands;
    }

    brandSelect.innerHTML =
        '<option value="" disabled selected hidden></option>';

    brands.forEach(brand => {
        const option = document.createElement("option");
        option.value = brand;
        option.textContent = brand;
        brandSelect.appendChild(option);
    });
}

deviceType.addEventListener("change", updateBrands);

updateBrands();

const ageMode = document.getElementById("age-mode");
console.log(ageMode);

if (ageMode) {

    ageMode.addEventListener("change", function () {

        console.log("Changed to:", this.value);

        const purchaseField =
            document.getElementById("purchase-year-field");

        const ageField =
            document.getElementById("device-age-field");

        const purchaseInput =
            document.getElementById("purchase-year");

        const ageInput =
            document.getElementById("device-age");

        if (this.value === "purchase_year") {
            purchaseInput.required = true;
            ageInput.required = false;

            purchaseField.style.display = "block";
            ageField.style.display = "none";
        } else {
            purchaseInput.required = false;
            ageInput.required = true;

            purchaseField.style.display = "none";
            ageField.style.display = "block";
        }

    });

    ageMode.dispatchEvent(new Event("change"));

}

  /* ---- Analyze form: validation + live /predict call ---- */
  const analyzeForm = document.getElementById('analyze-form');
  if (analyzeForm) {
    const submitBtn = document.getElementById('analyze-submit-btn');
    const apiErrorEl = document.getElementById('form-api-error');


    function setLoading(isLoading) {
      submitBtn?.classList.toggle('is-loading', isLoading);
      if (submitBtn) submitBtn.disabled = isLoading;
    }

    function showApiError(message) {
      if (!apiErrorEl) return;
      apiErrorEl.textContent = message;
      apiErrorEl.classList.add('is-visible');
    }

    function clearApiError() {
      if (!apiErrorEl) return;
      apiErrorEl.textContent = '';
      apiErrorEl.classList.remove('is-visible');
    }

    function formatCurrency(n) {
      return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    function renderResults(payload) {
      const {
    market_value,
    resale_value,
    retained_pct,
    grade,
    age_years,
    inputs,
    health_score,
    remaining_life,
    circular_score,
    recommendation
} = payload;

      document.getElementById('results-heading').textContent = 'Your device analysis';
      document.getElementById('results-subhead').textContent =
        'Live result from the valuation model, adjusted for age and condition.';

      document.getElementById('result-device-id').textContent =
        'DEVICE-ID · ' + Math.random().toString(36).slice(2, 8).toUpperCase();
      document.getElementById('result-title').textContent =
        `${inputs.brand} ${inputs.device_type} · ${inputs.storage}GB · ${inputs.condition} condition`;
      document.getElementById('result-grade').textContent = grade;

      document.getElementById('result-market-value').textContent = formatCurrency(market_value);
      document.getElementById('result-resale-value').innerHTML =
        formatCurrency(resale_value) + ' <span class="small">est.</span>';
      document.getElementById('result-resale-sub').textContent =
        `Adjusted for ${age_years} year${age_years === 1 ? '' : 's'} of age and ${inputs.condition.toLowerCase()} condition.`;
      document.getElementById('result-retained-pct').innerHTML =
        retained_pct + '<span class="small">%</span>';
      document.getElementById('result-retained-sub').textContent =
        'Of predicted market value, after depreciation.';

        document.getElementById('result-health-score').textContent =
    Math.round(health_score) + '/100';

document.getElementById('result-remaining-life').textContent =
    remaining_life.toFixed(1) + ' yrs';

document.getElementById('result-circular-score').textContent =
    Math.round(circular_score) + '/100';

      document.getElementById('detail-device-type').textContent = inputs.device_type;
      document.getElementById('detail-brand').textContent = inputs.brand;
      document.getElementById('detail-os').textContent = inputs.os;
      document.getElementById('detail-ram-storage').textContent = `${inputs.ram} GB / ${inputs.storage} GB`;
      document.getElementById('detail-screen').textContent = `${inputs.screen_size} in`;
      document.getElementById('detail-age').textContent = `${age_years} year${age_years === 1 ? '' : 's'}`;
      document.getElementById('detail-condition').textContent = inputs.condition;

const healthEl = document.getElementById('insight-health');

if (health_score >= 80) {
    healthEl.innerHTML =
    '<strong>Excellent Health.</strong> The device is in excellent condition with strong long-term usability.';
}
else if (health_score >= 60) {
    healthEl.innerHTML =
    '<strong>Good Health.</strong> The device remains reliable and suitable for continued use.';
}
else if (health_score >= 40) {
    healthEl.innerHTML =
    '<strong>Moderate Health.</strong> Signs of aging are becoming noticeable. Maintenance may improve longevity.';
}
else if (health_score >= 20) {
    healthEl.innerHTML =
    '<strong>Low Health.</strong> The device is approaching end-of-life and may require repair before further use.';
}
else {
    healthEl.innerHTML =
    '<strong>Critical Health.</strong> The device has very limited remaining usability.';
}

     const recEl = document.getElementById('insight-recommendation');

if (retained_pct >= 70) {
    recEl.innerHTML =
    '<strong>Reuse</strong> — The device retains substantial value and remains suitable for continued use.';
}
else if (retained_pct >= 40) {
    recEl.innerHTML =
    '<strong>Refurbish</strong> — The device still holds meaningful market value and can benefit from refurbishment before resale or reuse.';
}
else if (retained_pct >= 20) {
    recEl.innerHTML =
    '<strong>Repair</strong> — Repairing key components may extend the device\'s useful life and recover additional value.';
}
else {
    recEl.innerHTML =
    '<strong>Recycle</strong> — Material recovery through certified recycling is likely the most sustainable option.';
}

      document.getElementById('insight-condition').textContent =
  `Reported condition: ${inputs.condition}. This condition directly influences the device health score, remaining lifespan, and resale value.`;

     document.getElementById('insight-age').textContent =
  `Estimated remaining lifespan: ${remaining_life.toFixed(1)} years. Circular economy score: ${Math.round(circular_score)}/100.`;

  /* ---------- DASHBOARD UPDATE ---------- */

document.getElementById('dash-market-value').textContent =
    formatCurrency(market_value);

document.getElementById('dash-resale-value').textContent =
    formatCurrency(resale_value);

document.getElementById('dash-retention').textContent =
    retained_pct + '%';

document.getElementById('dash-retention-value').textContent =
    retained_pct + '%';

document.getElementById('dash-retention-bar').style.width =
    retained_pct + '%';

document.getElementById('dash-health-score').textContent =
    Math.round(health_score);

document.getElementById('dash-remaining-life').textContent =
    remaining_life.toFixed(1) + ' yrs';

document.getElementById('dash-circular-score').textContent =
    Math.round(circular_score);

document.getElementById('dash-device-type').textContent =
    inputs.device_type;

document.getElementById('dash-brand').textContent =
    inputs.brand;

document.getElementById('dash-os').textContent =
    inputs.os;

document.getElementById('dash-ram').textContent =
    inputs.ram + ' GB';

document.getElementById('dash-storage').textContent =
    inputs.storage + ' GB';

document.getElementById('dash-recommendation').textContent =
    recommendation;

document.getElementById('dash-recommendation-text').textContent =
    `Recommended action based on device health, resale value, and sustainability score.`;

      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    analyzeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearApiError();

      let valid = true;
      const currentRequiredFields =
    analyzeForm.querySelectorAll('[required]');

currentRequiredFields.forEach(f => {

    const field = f.closest('.field');

    if (f.type === 'radio') return;

    if (!f.value || f.value.trim() === '') {
        field?.classList.add('has-error');
        valid = false;
    } else {
        field?.classList.remove('has-error');
    }

});
      if (!analyzeForm.querySelector('input[name="condition"]:checked')) {
        valid = false;
      }

      if (!valid) {
        const firstError = analyzeForm.querySelector('.has-error');
        firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

    const payload = {
    device_type: document.getElementById('device-type').value,
    brand: document.getElementById('device-brand').value,
    os: document.getElementById('device-os').value,
    ram: document.getElementById('device-ram').value,
    storage: document.getElementById('device-storage').value,
    screen_size: document.getElementById('screen-size').value,

    age_mode: document.getElementById('age-mode').value,
    purchase_year: document.getElementById('purchase-year')?.value || "",
    age: document.getElementById('device-age')?.value || "",

    condition: analyzeForm.querySelector('input[name="condition"]:checked').value,
    };

      setLoading(true);
      try {
        const res = await fetch('/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log("FLASK RESPONSE:", data);
        if (!res.ok) {
          showApiError(data.error || 'Something went wrong while analyzing this device.');
          return;
        }
        renderResults(data);
      } catch (err) {
    console.error("FULL ERROR:", err);
    showApiError(err.message);
      } finally {
        setLoading(false);
      }
    });
  }

  /* ---- Photo dropzone ---- */
  const dropzone = document.querySelector('.dropzone');
  if (dropzone) {
    const fileInput = dropzone.querySelector('input[type="file"]');
    const previewImg = dropzone.querySelector('.preview-image-wrap img');
    const processingRow = dropzone.querySelector('.processing-row');
    const processingLabel = dropzone.querySelector('.processing-label');

    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        dropzone.classList.add('has-image');
        if (processingLabel) processingLabel.textContent = 'Reading device signature…';
        setTimeout(() => {
          dropzone.classList.remove('is-scanning');
          if (processingLabel) processingLabel.textContent = 'Image ready for analysis';
        }, 2600);
      };
      reader.readAsDataURL(file);
    }

    fileInput?.addEventListener('change', (e) => handleFile(e.target.files[0]));

    ['dragenter', 'dragover'].forEach(evt =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      })
    );
    ['dragleave', 'drop'].forEach(evt =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
      })
    );
    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    });
  }

  /* ---- Feature card index labels (computed, not hardcoded twice) ---- */
  document.querySelectorAll('.feature-card .feature-index').forEach((el, i) => {
    el.textContent = String(i + 1).padStart(2, '0');
  });

});

/* ============================================
   FORECAST DASHBOARD
============================================ */

const forecastData = {

    "Business as Usual": {
        generated: 82,
        recycled: 16,
        rate: 20
    },

    "Progressive Forecast": {
        generated: 82,
        recycled: 31,
        rate: 38
    },

    "Ambitious Forecast": {
        generated: 82,
        recycled: 37,
        rate: 44
    },

    "Aspirational Forecast": {
        generated: 82,
        recycled: 54,
        rate: 60
    }

};

/* ============================================
   FORECAST CHART
============================================ */

const chartCanvas = document.getElementById("forecastChart");

let forecastChart = null;

function drawForecastChart(recycledValue){

    if(!chartCanvas) return;

    if(forecastChart){

        forecastChart.destroy();

    }

    forecastChart = new Chart(chartCanvas,{

        type:"line",

        data:{

            labels:["2010","2022","2030"],

            datasets:[

                {

                    label:"Generated",

                    data:[34,62,82],

                    borderColor:"#111827",

                    backgroundColor:"#111827",

                    borderWidth:3,

                    pointRadius:5,
                    hoverRadius:6,
                    tension:.35

                },

                {

                    label:"Recycled",

                    data:[8,13.8,recycledValue],

                    borderColor:"#16a34a",

                    backgroundColor:"#16a34a",

                    borderWidth:3,

                    pointRadius:5,
                    hoverRadius:6,
                    tension:.35

                }

            ]

        },

        options:{

            responsive:true,

            maintainAspectRatio:false,

            plugins:{

    legend:{

        display:false

    }

},

            scales:{

                y:{

                    beginAtZero:true,

                    title:{

                        display:true,

                        text:"Million Tonnes"

                    }

                }

            }

        }

    });

}

const scenarioButtons = document.querySelectorAll(".scenario-btn");

let currentScenario = "Business as Usual";

function updateForecastCards() {

    const data = forecastData[currentScenario];

    document.getElementById("generatedWaste").textContent =
        data.generated;

    document.getElementById("recycledWaste").textContent =
        data.recycled;

    document.getElementById("recyclingRate").textContent =
        data.rate;

    document.getElementById("unrecycledWaste").textContent =
        data.generated - data.recycled;

    document.getElementById("scenarioName").textContent =
        currentScenario;
        drawForecastChart(data.recycled);
}

scenarioButtons.forEach(button => {

    button.addEventListener("click", () => {

        scenarioButtons.forEach(btn =>
            btn.classList.remove("active")
        );

        button.classList.add("active");

        currentScenario = button.dataset.value;

        updateForecastCards();

    });

});

updateForecastCards();