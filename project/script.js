const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
const navLinks = [...document.querySelectorAll(".nav a")];
const lightbox = document.getElementById("lightbox");
const lightboxImage = lightbox?.querySelector("img");
const lightboxClose = lightbox?.querySelector(".lightbox__close");
const galleryItems = document.querySelectorAll(".gallery-item");
const year = document.getElementById("year");
const sections = document.querySelectorAll("main section[id]");
const brandLink = document.querySelector(".brand");
const contactsSection = document.querySelector("footer#contacts");
const newsList = document.getElementById("news-list");
const preloader = document.getElementById("preloader");

const hidePreloader = () => {
  if (!preloader) return;

  preloader.classList.add("is-hidden");
  document.body.classList.remove("is-loading");

  window.setTimeout(() => {
    preloader.remove();
  }, 500);
};

if (preloader) {
  const startedAt = Date.now();
  let preloaderDone = false;
  const completePreloader = () => {
    if (preloaderDone) return;
    preloaderDone = true;

    const delay = Math.max(850 - (Date.now() - startedAt), 0);
    window.setTimeout(hidePreloader, delay);
  };

  if (document.readyState === "complete") {
    completePreloader();
  } else {
    window.addEventListener("load", completePreloader, { once: true });
    window.setTimeout(completePreloader, 1400);
  }
}

if (year) {
  year.textContent = new Date().getFullYear();
}

const closeNavigation = () => {
  if (!navToggle || !nav) return;
  nav.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
};

const smoothScrollToTarget = (targetId) => {
  const target = document.querySelector(targetId);
  const header = document.querySelector(".header");

  if (!target) return;

  const headerOffset = header ? header.offsetHeight + 14 : 0;
  const targetTop = target.getBoundingClientRect().top + window.scrollY - headerOffset;

  window.scrollTo({
    top: Math.max(targetTop, 0),
    behavior: "smooth",
  });
};

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });
}

[...navLinks, brandLink].filter(Boolean).forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");

    if (!targetId || !targetId.startsWith("#")) return;

    event.preventDefault();
    closeNavigation();
    smoothScrollToTarget(targetId);
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.2,
  }
);

const observeReveal = (items) => {
  items.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 0.04, 0.28)}s`;
    revealObserver.observe(item);
  });
};

observeReveal([...document.querySelectorAll(".reveal")]);

const escapeHTML = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });

const stripMarkdown = (value = "") =>
  String(value)
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const formatNewsDate = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const normalizeImagePath = (image = "") => {
  if (!image) return "./images/logo.png";
  if (image.startsWith("http") || image.startsWith("./")) return image;
  if (image.startsWith("/")) return `.${image}`;
  return `./${image}`;
};

const renderNews = (items = []) => {
  if (!newsList) return;

  const latestNews = items.slice(0, 3);

  if (!latestNews.length) {
    newsList.innerHTML = '<p class="news-empty reveal">Новини скоро зʼявляться.</p>';
    observeReveal([...newsList.querySelectorAll(".reveal")]);
    return;
  }

  newsList.innerHTML = latestNews
    .map((item) => {
      const image = normalizeImagePath(item.image);
      const date = formatNewsDate(item.date);
      const text = stripMarkdown(item.body || item.description);

      return `
        <article class="news-card card reveal">
          <img src="${escapeHTML(image)}" alt="${escapeHTML(item.title)}" />
          <div class="news-card__body">
            <span class="news-card__date">${escapeHTML(date || item.category || "Новина")}</span>
            <h3>${escapeHTML(item.title)}</h3>
            <p>${escapeHTML(text)}</p>
          </div>
        </article>
      `;
    })
    .join("");

  observeReveal([...newsList.querySelectorAll(".reveal")]);
};

const loadNews = async () => {
  if (!newsList) return;

  try {
    const response = await fetch("./news-data.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("News data is not available");
    }

    const news = await response.json();
    renderNews(news);
  } catch (error) {
    newsList.innerHTML =
      '<p class="news-empty reveal">Не вдалося завантажити новини. Спробуйте оновити сторінку.</p>';
    observeReveal([...newsList.querySelectorAll(".reveal")]);
  }
};

loadNews();

if (window.netlifyIdentity) {
  window.netlifyIdentity.on("init", (user) => {
    if (!user && window.location.hash.includes("invite_token")) {
      window.netlifyIdentity.open("signup");
    }
  });

  window.netlifyIdentity.on("login", () => {
    window.location.href = "/admin/";
  });
}

if (galleryItems.length && lightbox && lightboxImage && lightboxClose) {
  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  galleryItems.forEach((item) => {
    item.addEventListener("click", () => {
      const imageSrc = item.dataset.image;
      if (!imageSrc) return;
      lightboxImage.src = imageSrc;
      lightbox.classList.add("is-open");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    });
  });

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });
}

const trackedSections = [...sections];
if (contactsSection) trackedSections.push(contactsSection);

const setActiveNavLink = (id) => {
  navLinks.forEach((navLink) => {
    const isActive = navLink.getAttribute("href") === `#${id}`;
    navLink.classList.toggle("active", isActive);
  });
};

const updateActiveSection = () => {
  const header = document.querySelector(".header");
  const headerOffset = header ? header.offsetHeight + 28 : 96;
  const scrollPosition = window.scrollY + headerOffset;
  const pageBottom = window.scrollY + window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  if (pageBottom >= documentHeight - 4 && contactsSection) {
    setActiveNavLink("contacts");
    return;
  }

  let currentSectionId = trackedSections[0]?.id || "hero";

  trackedSections.forEach((section) => {
    if (scrollPosition >= section.offsetTop) {
      currentSectionId = section.id;
    }
  });

  setActiveNavLink(currentSectionId);
};

let isTicking = false;
const handleScroll = () => {
  if (isTicking) return;

  window.requestAnimationFrame(() => {
    updateActiveSection();
    isTicking = false;
  });

  isTicking = true;
};

window.addEventListener("scroll", handleScroll, { passive: true });
window.addEventListener("resize", updateActiveSection);
updateActiveSection();
