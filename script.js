"use strict";

(() => {
  const PROFILE_KEY = "motion_ai_profile_v3";
  const PROJECTS_KEY = "motion_ai_projects_v3";

  const $ = (selector) => document.querySelector(selector);

  const readStorage = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("Impossible d'enregistrer les données.");
      return false;
    }
  };

  let profile = readStorage(PROFILE_KEY, null);
  let projects = readStorage(PROJECTS_KEY, []);
  let currentStep = 0;
  let currentAnswers = {};
  let currentProjectId = null;
  let currentStoryboard = [];
  let toastTimer;
  let generating = false;
  let videoGenerating = false;
  let searchAnimTimer = null;

  if (!Array.isArray(projects)) projects = [];

  const steps = [
    {
      title: "Quelle est ton idée ?",
      description: "Décris la vidéo que tu souhaites créer.",
      type: "textarea",
      key: "idea",
      placeholder: "Exemple : une voiture sportive roule dans une ville futuriste la nuit...",
      required: true
    },
    {
      title: "Quel style visuel souhaites-tu ?",
      description: "Choisis l'univers visuel de ta vidéo.",
      key: "style",
      options: [
        ["Cinématique", "Rendu de film, cadrages travaillés"],
        ["Réaliste", "Un rendu proche de la réalité"],
        ["Animation 3D", "Univers entièrement en 3D"],
        ["Anime", "Style animation japonaise"],
        ["Documentaire", "Images naturelles et immersives"],
        ["Publicité", "Rendu professionnel et commercial"]
      ]
    },
    {
      title: "Quelle sera la durée ?",
      description: "Choisis la durée approximative de ta vidéo.",
      key: "duration",
      options: [
        ["5 secondes", "Très court"],
        ["10 secondes", "Format court"],
        ["15 secondes", "Format dynamique"],
        ["30 secondes", "Format intermédiaire"],
        ["60 secondes", "Format long"]
      ]
    },
    {
      title: "Quel format vidéo ?",
      description: "Choisis le format adapté à ta plateforme.",
      key: "format",
      options: [
        ["16:9", "Paysage · YouTube"],
        ["9:16", "Vertical · TikTok / Reels"],
        ["1:1", "Carré · Publications"],
        ["4:5", "Portrait · Réseaux sociaux"]
      ]
    },
    {
      title: "Quel mouvement de caméra ?",
      description: "Choisis la manière dont la caméra se déplace.",
      key: "camera",
      options: [
        ["Travelling", "La caméra avance ou recule"],
        ["Panoramique", "La caméra pivote horizontalement"],
        ["Plan fixe", "La caméra reste immobile"],
        ["Vue aérienne", "Vue depuis le ciel"],
        ["Caméra à l'épaule", "Mouvement naturel et immersif"],
        ["Zoom cinématique", "Rapprochement progressif"]
      ]
    },
    {
      title: "Quelle ambiance souhaites-tu ?",
      description: "Définis l'atmosphère générale de ta vidéo.",
      key: "mood",
      options: [
        ["Sombre et mystérieuse", "Ambiance intrigante"],
        ["Épique", "Grandeur et intensité"],
        ["Futuriste", "Technologie et science-fiction"],
        ["Calme et relaxante", "Atmosphère douce"],
        ["Dramatique", "Émotions et tension"],
        ["Énergique", "Rythme rapide et dynamique"]
      ]
    },
    {
      title: "Des détails supplémentaires ?",
      description: "Ajoute les éléments que tu souhaites retrouver dans la vidéo.",
      type: "textarea",
      key: "details",
      placeholder: "Exemple : pluie, lumières bleues, reflets sur la route, musique...",
      required: false
    }
  ];

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2600);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showPage(pageName) {
    const target = $("#" + pageName);
    if (!target) return;

    document.querySelectorAll(".page").forEach(page => {
      page.classList.remove("active");
    });

    target.classList.add("active");

    document.querySelectorAll(".nav-link").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === pageName
      );
    });

    if (pageName === "history") renderProjects();
    if (pageName === "account") renderAccount();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateBrief() {
    const fields = {
      type: "Vidéo",
      style: currentAnswers.style,
      duration: currentAnswers.duration,
      format: currentAnswers.format
    };

    Object.entries(fields).forEach(([key, value]) => {
      const element = $("#brief-" + key);
      if (element) element.textContent = value || "À définir";
    });
  }

  function updateProgress() {
    const percent = Math.round(
      ((currentStep + 1) / steps.length) * 100
    );

    const label = $("#step-label");
    const progress = $("#progress-percent");
    const bar = $("#progress-bar");
    const previous = $("#previous-step");
    const next = $("#next-step");

    if (label) label.textContent = `ÉTAPE ${currentStep + 1} SUR ${steps.length}`;
    if (progress) progress.textContent = percent + "%";
    if (bar) bar.style.width = percent + "%";
    if (previous) {
      previous.style.visibility = currentStep === 0 ? "hidden" : "visible";
    }

    if (next) {
      next.textContent = currentStep === steps.length - 1
        ? "Générer mon résultat →"
        : "Continuer →";
    }
  }

  function renderStep() {
    const step = steps[currentStep];
    const container = $("#question-content");
    if (!container) return;

    let html = `
      <span class="eyebrow">ÉTAPE ${currentStep + 1}</span>
      <h2>${escapeHTML(step.title)}</h2>
      <p class="question-description">
        ${escapeHTML(step.description)}
      </p>
    `;

    if (step.type === "textarea") {
      html += `
        <div class="form-field">
          <label for="step-answer">
            ${step.key === "idea" ? "Ton idée" : "Tes détails"}
          </label>
          <textarea
            id="step-answer"
            placeholder="${escapeHTML(step.placeholder)}"
            rows="5"
          >${escapeHTML(currentAnswers[step.key] || "")}</textarea>
        </div>
      `;
    } else {
      html += `<div class="option-grid">`;

      step.options.forEach(([name, description]) => {
        const selected = currentAnswers[step.key] === name;

        html += `
          <button
            type="button"
            class="option-card ${selected ? "selected" : ""}"
            data-option="${escapeHTML(name)}"
          >
            <strong>${escapeHTML(name)}</strong>
            <small>${escapeHTML(description)}</small>
          </button>
        `;
      });

      html += `</div>`;
    }

    container.innerHTML = html;
    updateProgress();
    updateBrief();
  }

  function validateStep() {
    const step = steps[currentStep];

    if (step.type === "textarea") {
      const field = $("#step-answer");
      if (!field) return false;

      const value = field.value.trim();

      if (step.required && !value) {
        showToast("Décris d'abord ton idée.");
        field.focus();
        return false;
      }

      currentAnswers[step.key] = value;
      return true;
    }

    if (!currentAnswers[step.key]) {
      showToast("Choisis une option pour continuer.");
      return false;
    }

    return true;
  }

  function makePrompt() {
    const a = currentAnswers;

    return `Crée une vidéo de ${a.duration || "10 secondes"} au format ${a.format || "16:9"}.

CONCEPT :
${a.idea || ""}

STYLE VISUEL :
${a.style || "Cinématique"}.

MOUVEMENT DE CAMÉRA :
${a.camera || "Travelling"}.

AMBIANCE :
${a.mood || "Cinématique"}.

DÉTAILS :
${a.details || "Aucun détail supplémentaire."}

DIRECTION ARTISTIQUE :
Créer une composition visuellement cohérente, avec une attention particulière portée à la lumière, aux couleurs, aux textures et à la profondeur de champ.

CAMÉRA ET MISE EN SCÈNE :
Respecter le mouvement de caméra choisi. Garder des mouvements fluides, naturels et maîtrisés.

QUALITÉ VISUELLE :
Rendu détaillé, éclairage soigné, composition professionnelle, transitions fluides et cohérence visuelle entre les scènes.

OBJECTIF :
Produire une vidéo qui respecte fidèlement le concept initial et l'ensemble des choix sélectionnés.`;
  }

  function makeStoryboard() {
    const a = currentAnswers;

    return [
      {
        title: "Introduction",
        description: `Présenter l'univers de la vidéo : ${a.idea}. Installer progressivement l'ambiance ${a.mood || "cinématique"}.`
      },
      {
        title: "Développement",
        description: `Mettre en valeur le sujet principal avec un style ${a.style || "cinématique"} et un mouvement de caméra de type ${a.camera || "travelling"}.`
      },
      {
        title: "Moment principal",
        description: "Créer le plan le plus marquant de la vidéo, avec une composition soignée et une mise en scène cohérente."
      },
      {
        title: "Conclusion",
        description: "Terminer avec un dernier plan esthétique et une transition adaptée à l'ambiance générale."
      }
    ];
  }

  // CONNEXION AU SERVEUR GEMINI
  async function generateMotionPromptWithGemini(userAnswers = {}) {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ answers: userAnswers })
    });

    if (!response.ok) {
      throw new Error(`Erreur serveur (${response.status})`);
    }

    const result = await response.json();

    if (
      typeof result.prompt !== "string" ||
      !Array.isArray(result.storyboard) ||
      result.storyboard.some(scene =>
        !scene ||
        typeof scene.title !== "string" ||
        typeof scene.description !== "string"
      )
    ) {
      throw new Error("Réponse Gemini invalide.");
    }

    return result;
  }

  window.generateMotionPromptWithGemini =
    generateMotionPromptWithGemini;

  function renderStoryboard(scenes) {
    const container = $("#storyboard-content");
    if (!container) return;

    container.innerHTML = scenes.map((scene, index) => `
      <div class="storyboard-scene">
        <div class="scene-number">0${index + 1}</div>
        <div>
          <h3>${escapeHTML(scene.title)}</h3>
          <p>${escapeHTML(scene.description)}</p>
        </div>
      </div>
    `).join("");
  }

  function parseDurationSeconds(durationLabel) {
    const match = String(durationLabel || "").match(/\d+/);
    const num = match ? Number(match[0]) : 10;
    return Math.min(Math.max(num || 10, 3), 60);
  }

  function ensureVideoUI() {
    const resultSection = $("#result");
    if (!resultSection) return null;

    let box = $("#motion-video-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "motion-video-box";
      box.style.marginTop = "24px";
      box.style.padding = "18px";
      box.style.borderRadius = "14px";
      box.style.border = "1px solid rgba(168, 85, 247, 0.35)";
      box.style.background = "rgba(15, 23, 42, 0.78)";

      box.innerHTML = `
        <style>
          @keyframes motionPulseBar {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(140%); }
            100% { transform: translateX(-100%); }
          }
          #video-search-loader.active {
            display: block !important;
          }
          #video-search-bar {
            width: 42%;
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(90deg, #7c3aed, #a855f7, #38bdf8);
            animation: motionPulseBar 1.6s ease-in-out infinite;
          }
        </style>
        <button type="button" class="primary-button" id="generate-video-mp4">
          Générer la vidéo (.mp4)
        </button>
        <div id="video-search-loader" style="display:none;margin-top:14px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#cbd5e1;margin-bottom:8px;">
            <span id="video-search-step">Recherche des scènes et préparation du rendu...</span>
          </div>
          <div style="width:100%;height:6px;border-radius:999px;background:rgba(255,255,255,0.12);overflow:hidden;">
            <div id="video-search-bar"></div>
          </div>
        </div>
        <p id="video-status-text" style="margin-top:10px;font-size:14px;opacity:0.9;"></p>
        <div id="video-player-wrap" style="margin-top:14px;"></div>
      `;

      const promptBox = $("#generated-prompt")?.parentElement;
      if (promptBox && promptBox.parentElement === resultSection) {
        promptBox.insertAdjacentElement("afterend", box);
      } else {
        resultSection.appendChild(box);
      }
    }

    return box;
  }

  function startSearchAnimation(statusEl) {
    const loader = $("#video-search-loader");
    const stepEl = $("#video-search-step");
    if (loader) loader.classList.add("active");

    const phrases = [
      "Recherche et analyse de tes choix de scène...",
      "Assemblage du style visuel et de la caméra...",
      "Rendu vidéo .mp4 en cours sur le serveur...",
      "Finalisation et vérification de la vidéo..."
    ];
    let idx = 0;

    if (stepEl) stepEl.textContent = phrases[0];
    if (statusEl) statusEl.textContent = "";

    clearInterval(searchAnimTimer);
    searchAnimTimer = setInterval(() => {
      idx = (idx + 1) % phrases.length;
      if (stepEl) stepEl.textContent = phrases[idx];
    }, 2400);
  }

  function stopSearchAnimation() {
    clearInterval(searchAnimTimer);
    searchAnimTimer = null;
    const loader = $("#video-search-loader");
    if (loader) loader.classList.remove("active");
  }

  async function generateVideoFromChoices() {
    if (videoGenerating) return;
    videoGenerating = true;

    const ui = ensureVideoUI();
    const btn = $("#generate-video-mp4");
    const statusEl = $("#video-status-text");
    const playerWrap = $("#video-player-wrap");

    if (!ui || !btn || !statusEl || !playerWrap) {
      videoGenerating = false;
      return;
    }

    const a = currentAnswers || {};
    const promptText = $("#generated-prompt")?.textContent || a.idea || "Vidéo MOTION AI";
    const titleText = (a.idea || "MOTION AI").slice(0, 50);
    const durationSec = parseDurationSeconds(a.duration);

    btn.disabled = true;
    btn.textContent = "Recherche & rendu en cours...";
    playerWrap.innerHTML = "";
    startSearchAnimation(statusEl);

    try {
      const response = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleText,
          script: `${a.idea || ""} — ${a.mood || ""} (${a.camera || ""}) | ${promptText.slice(0, 120)}`,
          style: a.style || "Cinématique",
          format: a.format || "16:9",
          duration: durationSec
        })
      });

      const data = await response.json();

      if (!response.ok && response.status !== 202) {
        throw new Error(data.error || `Erreur (${response.status})`);
      }

      stopSearchAnimation();

      if (data.url) {
        statusEl.textContent = "Vidéo prête !";
        playerWrap.innerHTML = `
          <video
            controls
            playsinline
            src="${escapeHTML(data.url)}"
            style="width:100%;max-height:420px;border-radius:12px;background:#000;"
          ></video>
          <div style="margin-top:10px;">
            <a
              href="${escapeHTML(data.url)}"
              download="motion-ai.mp4"
              target="_blank"
              rel="noopener noreferrer"
              class="secondary-button"
              style="display:inline-block;text-decoration:none;"
            >
              Télécharger le .mp4
            </a>
          </div>
        `;
        showToast("Vidéo générée avec succès !");
      } else {
        statusEl.textContent = data.message || "La vidéo est toujours en cours de rendu, réessaie dans quelques secondes.";
        showToast("Rendu toujours en cours...");
      }
    } catch (err) {
      stopSearchAnimation();
      console.error("Vidéo MOTION AI :", err);
      statusEl.textContent = `Impossible de générer la vidéo : ${err.message}`;
      showToast("Erreur lors de la génération vidéo.");
    } finally {
      videoGenerating = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Générer la vidéo (.mp4)";
      }
    }
  }

  async function generateResult() {
    if (generating) return;

    generating = true;

    const button = $("#next-step");
    if (button) {
      button.disabled = true;
      button.textContent = "Génération avec Gemini...";
    }

    try {
      const result = await generateMotionPromptWithGemini(currentAnswers);

      currentStoryboard = result.storyboard;

      $("#generated-prompt").textContent = result.prompt;
      renderStoryboard(currentStoryboard);
      ensureVideoUI();

      currentProjectId = null;
      showPage("result");

      showToast("Création générée avec Gemini !");
    } catch (error) {
      console.error("MOTION AI :", error);

      // Solution de secours si le serveur n'est pas encore configuré
      currentStoryboard = makeStoryboard();

      $("#generated-prompt").textContent = makePrompt();
      renderStoryboard(currentStoryboard);
      ensureVideoUI();

      showToast("Gemini indisponible : résultat de secours affiché.");
      showPage("result");
    } finally {
      generating = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Générer mon résultat →";
      }
    }
  }

  function restartCreator() {
    currentStep = 0;
    currentAnswers = {};
    currentProjectId = null;
    currentStoryboard = [];

    renderStep();
    showPage("creator");
  }

  function createId() {
    return Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);
  }

  function saveProject() {
    const idea = currentAnswers.idea || "Projet sans titre";

    const existingIndex = projects.findIndex(
      project => project.id === currentProjectId
    );

    const project = {
      id: currentProjectId || createId(),
      name: idea.length > 45 ? idea.slice(0, 45) + "..." : idea,
      answers: { ...currentAnswers },
      prompt: $("#generated-prompt")?.textContent || "",
      scenes: currentStoryboard.length
        ? currentStoryboard
        : makeStoryboard(),
      date: new Date().toLocaleDateString("fr-FR")
    };

    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.unshift(project);
    }

    currentProjectId = project.id;

    if (writeStorage(PROJECTS_KEY, projects)) {
      showToast("Projet enregistré !");
    }
  }

  function renderProjects() {
    const list = $("#projects-list");
    const empty = $("#empty-projects");

    if (!list || !empty) return;

    if (!projects.length) {
      list.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";

    list.innerHTML = projects.map(project => `
      <article class="history-item">
        <small>PROJET · ${escapeHTML(project.date || "")}</small>
        <h3>${escapeHTML(project.name)}</h3>
        <p>${escapeHTML(project.answers?.style || "Style non défini")} ·
        ${escapeHTML(project.answers?.duration || "")}</p>
        <div class="history-actions">
          <button data-action="open-project" data-id="${escapeHTML(project.id)}">
            Ouvrir
          </button>
          <button data-action="delete-project" data-id="${escapeHTML(project.id)}">
            Supprimer
          </button>
        </div>
      </article>
    `).join("");
  }

  function openProject(id) {
    const project = projects.find(item => item.id === id);
    if (!project) return;

    currentAnswers = { ...project.answers };
    currentProjectId = project.id;
    currentStoryboard = project.scenes || [];

    $("#generated-prompt").textContent = project.prompt || "";
    renderStoryboard(currentStoryboard);
    ensureVideoUI();

    showPage("result");
  }

  function deleteProject(id) {
    if (!confirm("Supprimer définitivement ce projet ?")) return;

    projects = projects.filter(project => project.id !== id);
    writeStorage(PROJECTS_KEY, projects);

    if (currentProjectId === id) {
      currentProjectId = null;
    }

    renderProjects();
    showToast("Projet supprimé.");
  }

  function renderAccount() {
    const content = $("#account-content");
    const actions = $("#account-actions");

    if (!content || !actions) return;

    if (profile && profile.email) {
      content.innerHTML = `
        <span class="eyebrow">PROFIL ACTIF</span>
        <h2>Bienvenue ${escapeHTML(profile.name)} !</h2>
        <p>Adresse associée : ${escapeHTML(profile.email)}</p>
        <p>Ton profil est enregistré localement sur cet appareil.</p>
      `;

      actions.innerHTML = `
        <button class="secondary-button" id="logout">Déconnexion</button>
        <button class="secondary-button" id="delete-account">
          Supprimer mon profil
        </button>
      `;
    } else {
      content.innerHTML = `
        <span class="eyebrow">MODE INVITÉ</span>
        <h2>Crée ton profil.</h2>
        <p>Ce profil de démonstration est stocké uniquement dans ton navigateur.</p>

        <div class="form-field">
          <label for="profile-name">Ton prénom ou pseudo</label>
          <input id="profile-name" type="text" placeholder="Exemple : Alex">
        </div>

        <div class="form-field">
          <label for="profile-email">Ton adresse e-mail</label>
          <input id="profile-email" type="email" placeholder="exemple@email.com">
        </div>
      `;

      actions.innerHTML = `
        <button class="primary-button" id="register-account">
          Créer mon profil
        </button>
        <button class="secondary-button" id="login-account">
          Retrouver mon profil
        </button>
      `;
    }

    renderAccountStatus();
  }

  function renderAccountStatus() {
    const status = $("#account-status");
    if (status) {
      status.textContent = profile?.name || "Mode invité";
    }
  }

  function registerAccount() {
    const name = $("#profile-name")?.value.trim();
    const email = $("#profile-email")?.value.trim();

    if (!name || !email) {
      showToast("Remplis les deux champs.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("Adresse e-mail invalide.");
      return;
    }

    profile = { name, email };

    if (writeStorage(PROFILE_KEY, profile)) {
      renderAccount();
      showToast("Profil créé !");
    }
  }

  function loginAccount() {
    const email = $("#profile-email")?.value.trim();
    const savedProfile = readStorage(PROFILE_KEY, null);

    if (!savedProfile || savedProfile.email !== email) {
      showToast("Aucun profil correspondant sur cet appareil.");
      return;
    }

    profile = savedProfile;
    renderAccount();
    showToast("Profil retrouvé !");
  }

  function logoutAccount() {
    profile = null;

    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {}

    renderAccount();
    showToast("Déconnexion effectuée.");
  }

  function deleteAccount() {
    if (!confirm("Supprimer ton profil de cet appareil ?")) return;

    profile = null;

    try {
      localStorage.removeItem(PROFILE_KEY);
    } catch {}

    renderAccount();
    showToast("Profil supprimé.");
  }

  async function copyPrompt() {
    const text = $("#generated-prompt")?.textContent || "";

    try {
      await navigator.clipboard.writeText(text);
      showToast("Prompt copié !");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
        showToast("Prompt copié !");
      } catch {
        showToast("Copie impossible sur cet appareil.");
      }

      textarea.remove();
    }
  }

  function handleClick(event) {
    const pageButton = event.target.closest("[data-page]");

    if (pageButton) {
      event.preventDefault();
      showPage(pageButton.dataset.page);
      return;
    }

    const optionButton = event.target.closest("[data-option]");

    if (optionButton) {
      const step = steps[currentStep];
      currentAnswers[step.key] = optionButton.dataset.option;
      renderStep();
      return;
    }

    const actionButton = event.target.closest("[data-action]");

    if (actionButton) {
      const id = actionButton.dataset.id;

      if (actionButton.dataset.action === "open-project") {
        openProject(id);
      }

      if (actionButton.dataset.action === "delete-project") {
        deleteProject(id);
      }

      return;
    }

    switch (event.target.id) {
      case "account-button":
        showPage("account");
        break;

      case "next-step":
        if (generating || !validateStep()) return;

        if (currentStep < steps.length - 1) {
          currentStep++;
          renderStep();
        } else {
          generateResult();
        }
        break;

      case "previous-step":
        if (currentStep > 0 && !generating) {
          currentStep--;
          renderStep();
        }
        break;

      case "generate-video-mp4":
        generateVideoFromChoices();
        break;

      case "copy-prompt":
        copyPrompt();
        break;

      case "save-project":
        saveProject();
        break;

      case "new-project":
        restartCreator();
        break;

      case "register-account":
        registerAccount();
        break;

      case "login-account":
        loginAccount();
        break;

      case "logout":
        logoutAccount();
        break;

      case "delete-account":
        deleteAccount();
        break;
    }
  }

  function init() {
    document.addEventListener("click", handleClick);

    renderStep();
    renderAccountStatus();
    renderProjects();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
