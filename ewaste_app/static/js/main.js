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

//         document.getElementById('result-health-score').textContent =
//     Math.round(health_score) + '/100';

// document.getElementById('result-remaining-life').textContent =
//     remaining_life.toFixed(1) + ' yrs';

// document.getElementById('result-circular-score').textContent =
//     Math.round(circular_score) + '/100';

      document.getElementById('detail-device-type').textContent = inputs.device_type;
      document.getElementById('detail-brand').textContent = inputs.brand;
      document.getElementById('detail-os').textContent = inputs.os;
      document.getElementById('detail-ram-storage').textContent = `${inputs.ram} GB / ${inputs.storage} GB`;
      document.getElementById('detail-screen').textContent = `${inputs.screen_size} in`;
      document.getElementById('detail-age').textContent = `${age_years} year${age_years === 1 ? '' : 's'}`;
      document.getElementById('detail-condition').textContent = inputs.condition;
//       const healthEl = document.getElementById('insight-health');

// if (health_score >= 85) {
//     healthEl.innerHTML =
//         '<strong>Excellent health.</strong> Device is in strong condition with significant usable life remaining.';
// }
// else if (health_score >= 70) {
//     healthEl.innerHTML =
//         '<strong>Good health.</strong> Device remains reliable and suitable for continued use or resale.';
// }
// else if (health_score >= 50) {
//     healthEl.innerHTML =
//         '<strong>Average health.</strong> Performance and value are beginning to decline but refurbishment may still be worthwhile.';
// }
// else {
//     healthEl.innerHTML =
//         '<strong>Poor health.</strong> Device is nearing end-of-life and may be better suited for repair or recycling.';
// }

     const recEl = document.getElementById('insight-recommendation');

if (recommendation === "Keep Using") {
    recEl.innerHTML =
        '<strong>Keep Using</strong> — device health remains high and replacement is not yet necessary.';
}
else if (recommendation === "Refurbish") {
    recEl.innerHTML =
        '<strong>Refurbish</strong> — repairing or upgrading the device can extend its useful lifespan.';
}
else if (recommendation === "Recycle") {
    recEl.innerHTML =
        '<strong>Recycle Responsibly</strong> — recovery of materials may provide more value than continued use.';
}
else {
    recEl.innerHTML =
        '<strong>Review Device</strong> — additional inspection is recommended before making a decision.';
}

      document.getElementById('insight-condition').textContent =
        inputs.condition === 'Excellent'
          ? 'This device is already at the top condition tier — little further value to recover here.'
          : 'Condition is the largest adjustable factor between this grade and "Excellent."';

      document.getElementById('insight-age').textContent =
        `At ${age_years} year${age_years === 1 ? '' : 's'} old, this device retains ${retained_pct}% of its predicted market value.`;

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
        dropzone.classList.add('has-image', 'is-scanning');
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
