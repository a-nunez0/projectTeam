const movieContainer = document.getElementById("movieContainer");
const genreFilter = document.getElementById("genreFilter");
const sortFilter = document.getElementById("sortFilter");
const searchInput = document.getElementById("searchInput");

const movieModal = document.getElementById("movieModal");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModal");
const modalBackdrop = document.getElementById("modalBackdrop");

let allMovies = [];

const TMDB_BEARER_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiZDk1MTg4MmU3ZWMzYWVmYjhiZmQ3OWNiMDhiNTM5YiIsIm5iZiI6MTc3NDY3MDgyMS43MTI5OTk4LCJzdWIiOiI2OWM3NTNlNWE3YTg5ZDJkN2Y5ZDQ4YTUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.MzqXwPHdW65nFC2-qRBD5_Aw7_CumPFfJbkkxvUsJa4";

async function loadMovies() {
  try {
    const response = await fetch("./data/movies.json");

    if (!response.ok) {
      throw new Error("Could not load movies.json");
    }

    const movies = await response.json();
    allMovies = movies;

    populateGenres(movies);
    filterAndSortMovies();
    openFromURL();
  } catch (error) {
    movieContainer.innerHTML =
      `<p class="empty-message">Failed to load movies.</p>`;
    console.error(error);
  }
}

function populateGenres(movies) {
  const genres = [...new Set(movies.map((m) => m.genre))].sort();

  genres.forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    genreFilter.appendChild(option);
  });
}

function displayMovies(movies) {
  movieContainer.innerHTML = "";

  if (movies.length === 0) {
    const searchText = searchInput.value.trim();

    movieContainer.innerHTML = `
      <p class="empty-message">
        Sorry, we couldn’t find "${searchText}".
      </p>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  movies.forEach((movie) => {
    const hasPoster = movie.poster && movie.poster.trim() !== "";

    const posterHTML = hasPoster
      ? `<img src="${movie.poster}" class="movie-poster" alt="${movie.title}" loading="lazy">`
      : `<div class="no-poster">${movie.title}</div>`;

    const card = document.createElement("article");
    card.classList.add("movie-card");

    card.innerHTML = `
      <div class="poster-container">
        ${posterHTML}
      </div>

      <div class="movie-info">
        <h2>${movie.title}</h2>
        <span class="genre">${movie.genre}</span>
        <p>${movie.description}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      const encoded = encodeURIComponent(movie.title);
      window.history.pushState({ movieId: encoded }, "", `?id=${encoded}`);
      openMovieModal(movie);
    });

    fragment.appendChild(card);
  });

  movieContainer.appendChild(fragment);
}

function filterAndSortMovies() {
  let movies = [...allMovies];

  const selectedGenre = genreFilter.value;
  const selectedSort = sortFilter.value;
  const searchText = searchInput.value.toLowerCase().trim();

  if (selectedGenre !== "All") {
    movies = movies.filter((m) => m.genre === selectedGenre);
  }

  if (searchText !== "") {
    movies = movies.filter((m) =>
      m.title.toLowerCase().includes(searchText)
    );
  }

  if (selectedSort === "az") {
    movies.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (selectedSort === "za") {
    movies.sort((a, b) => b.title.localeCompare(a.title));
  }

  displayMovies(movies);
}

async function getMovieFromTMDb(title) {
  const url =
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Failed to search movie in TMDb");
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    return null;
  }

  return data.results[0];
}

async function getMovieDetails(movieId) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Failed to get movie details");
  }

  return await response.json();
}

async function getWatchProviders(movieId) {
  const url = `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Failed to get watch providers");
  }

  return await response.json();
}

function formatReleaseDate(dateString) {
  if (!dateString) {
    return "Not available";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function getProviderNames(providerData) {
  const usProviders = providerData.results?.US;

  if (!usProviders) {
    return {
      stream: [],
      rent: [],
      buy: []
    };
  }

  return {
    stream: usProviders.flatrate || [],
    rent: usProviders.rent || [],
    buy: usProviders.buy || []
  };
}

function createProviderList(title, providers) {
  if (!providers.length) {
    return `
      <div class="provider-block">
        <h4>${title}</h4>
        <p class="provider-empty">Not available</p>
      </div>
    `;
  }

  return `
    <div class="provider-block">
      <h4>${title}</h4>
      <div class="provider-list">
        ${providers.map((provider) => `
          <span class="provider-pill">${provider.provider_name}</span>
        `).join("")}
      </div>
    </div>
  `;
}

function isValidGmail(email) {
  const pattern = /^[a-z0-9._%+-]+@gmail\.com$/i;
  return pattern.test(email.trim());
}

function saveReview(movieTitle, reviewData) {
  const key = "movieReviews";
  const existingReviews = JSON.parse(localStorage.getItem(key)) || [];

  existingReviews.push({
    movieTitle,
    email: reviewData.email,
    name: reviewData.name,
    review: reviewData.review,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(key, JSON.stringify(existingReviews));
}

function setupReviewForm(movie) {
  const reviewToggleBtn = document.getElementById("reviewToggleBtn");
  const reviewFormWrap = document.getElementById("reviewFormWrap");
  const reviewForm = document.getElementById("reviewForm");
  const reviewEmail = document.getElementById("reviewEmail");
  const reviewName = document.getElementById("reviewName");
  const reviewText = document.getElementById("reviewText");
  const reviewMessage = document.getElementById("reviewMessage");

  if (!reviewToggleBtn || !reviewFormWrap || !reviewForm) {
    return;
  }

  reviewToggleBtn.addEventListener("click", () => {
    reviewFormWrap.classList.toggle("hidden");
  });

  reviewForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = reviewEmail.value.trim().toLowerCase();
    const name = reviewName.value.trim();
    const review = reviewText.value.trim();

    if (!isValidGmail(email)) {
      reviewMessage.textContent = "Please enter a valid Gmail address.";
      reviewMessage.className = "review-message error";
      return;
    }

    if (name === "" || review === "") {
      reviewMessage.textContent = "Please fill out all fields.";
      reviewMessage.className = "review-message error";
      return;
    }

    saveReview(movie.title, {
      email,
      name,
      review
    });

    reviewMessage.textContent = `Thanks ${name}! Your review was submitted.`;
    reviewMessage.className = "review-message success";

    reviewForm.reset();
  });
}

async function openMovieModal(movie) {
  movieModal.classList.remove("hidden");

  modalBody.innerHTML = `
    <div class="modal-loading">
      <p>Loading movie details...</p>
    </div>
  `;

  try {
    const tmdbMovie = await getMovieFromTMDb(movie.title);

    if (!tmdbMovie) {
      modalBody.innerHTML = `
        <div class="modal-movie-layout">
          <div>
            <h2>${movie.title}</h2>
            <span class="genre modal-genre">${movie.genre}</span>
            <p class="modal-description">${movie.description}</p>
            <p><strong>Release Date:</strong> Not found</p>
            <p><strong>Where to Watch:</strong> Not found</p>

            <div class="review-area">
              <button id="reviewToggleBtn" class="review-toggle-btn">Leave a Review</button>

              <div id="reviewFormWrap" class="review-form-wrap hidden">
                <form id="reviewForm" class="review-form">
                  <input
                    type="email"
                    id="reviewEmail"
                    placeholder="Enter your Gmail"
                    required
                  />

                  <input
                    type="text"
                    id="reviewName"
                    placeholder="Your name"
                    required
                  />

                  <textarea
                    id="reviewText"
                    placeholder="Write your review here..."
                    rows="4"
                    required
                  ></textarea>

                  <button type="submit" class="review-submit-btn">Submit Review</button>
                </form>

                <p id="reviewMessage" class="review-message"></p>
              </div>
            </div>
          </div>
        </div>
      `;

      setupReviewForm(movie);
      return;
    }

    const details = await getMovieDetails(tmdbMovie.id);
    const providersData = await getWatchProviders(tmdbMovie.id);

    const releaseDate = formatReleaseDate(details.release_date);
    const providers = getProviderNames(providersData);

    const posterHTML = movie.poster && movie.poster.trim() !== ""
      ? `<img src="${movie.poster}" alt="${movie.title}" class="modal-poster">`
      : `<div class="modal-no-poster">${movie.title}</div>`;

    modalBody.innerHTML = `
      <div class="modal-movie-layout">
        <div class="modal-poster-wrap">
          ${posterHTML}
        </div>

        <div class="modal-text">
          <h2>${movie.title}</h2>
          <span class="genre modal-genre">${movie.genre}</span>

          <p class="modal-description">${movie.description}</p>

          <p class="modal-release">
            <strong>Release Date:</strong> ${releaseDate}
          </p>

          <div class="watch-section">
            <h3>Where to Watch (US)</h3>

            ${createProviderList("Streaming", providers.stream)}
            ${createProviderList("Rent", providers.rent)}
            ${createProviderList("Buy", providers.buy)}
          </div>

          <div class="review-area">
            <button id="reviewToggleBtn" class="review-toggle-btn">Leave a Review</button>

            <div id="reviewFormWrap" class="review-form-wrap hidden">
              <form id="reviewForm" class="review-form">
                <input
                  type="email"
                  id="reviewEmail"
                  placeholder="Enter your Gmail"
                  required
                />

                <input
                  type="text"
                  id="reviewName"
                  placeholder="Your name"
                  required
                />

                <textarea
                  id="reviewText"
                  placeholder="Write your review here..."
                  rows="4"
                  required
                ></textarea>

                <button type="submit" class="review-submit-btn">Submit Review</button>
              </form>

              <p id="reviewMessage" class="review-message"></p>
            </div>
          </div>
        </div>
      </div>
    `;

    setupReviewForm(movie);
  } catch (error) {
    console.error(error);

    modalBody.innerHTML = `
      <div class="modal-error">
        <h2>${movie.title}</h2>
        <p>${movie.description}</p>
        <p><strong>Release Date:</strong> Could not load</p>
        <p><strong>Where to Watch:</strong> Could not load</p>

        <div class="review-area">
          <button id="reviewToggleBtn" class="review-toggle-btn">Leave a Review</button>

          <div id="reviewFormWrap" class="review-form-wrap hidden">
            <form id="reviewForm" class="review-form">
              <input
                type="email"
                id="reviewEmail"
                placeholder="Enter your Gmail"
                required
              />

              <input
                type="text"
                id="reviewName"
                placeholder="Your name"
                required
              />

              <textarea
                id="reviewText"
                placeholder="Write your review here..."
                rows="4"
                required
              ></textarea>

              <button type="submit" class="review-submit-btn">Submit Review</button>
            </form>

            <p id="reviewMessage" class="review-message"></p>
          </div>
        </div>
      </div>
    `;

    setupReviewForm(movie);
  }
}

function closeMovieModal() {
  movieModal.classList.add("hidden");
  window.history.pushState({}, "", window.location.pathname);
}

function openFromURL() {
  const params = new URLSearchParams(window.location.search);
  const movieId = params.get("id");

  if (!movieId) {
    return;
  }

  const decoded = decodeURIComponent(movieId);

  const movie = allMovies.find(
    (m) => m.title.toLowerCase() === decoded.toLowerCase()
  );

  if (movie) {
    openMovieModal(movie);
  }
}

genreFilter.addEventListener("change", filterAndSortMovies);
sortFilter.addEventListener("change", filterAndSortMovies);
searchInput.addEventListener("input", filterAndSortMovies);

closeModalBtn.addEventListener("click", closeMovieModal);
modalBackdrop.addEventListener("click", closeMovieModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !movieModal.classList.contains("hidden")) {
    closeMovieModal();
  }
});

window.addEventListener("popstate", () => {
  const params = new URLSearchParams(window.location.search);
  const movieId = params.get("id");

  if (movieId) {
    const decoded = decodeURIComponent(movieId);

    const movie = allMovies.find(
      (m) => m.title.toLowerCase() === decoded.toLowerCase()
    );

    if (movie) {
      openMovieModal(movie);
    }
  } else {
    movieModal.classList.add("hidden");
  }
});

const menuToggle = document.getElementById("menuToggle");
const controls = document.querySelector(".controls");

if (menuToggle && controls) {
  menuToggle.addEventListener("click", () => {
    controls.classList.toggle("show");
  });
}

loadMovies();