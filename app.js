// =================================================================
// 1. FIREBASE CONFIGURATION
// =================================================================
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqoN7rA8ql_iJfGpcZGhKuFi5tGSPbXAc",
  authDomain: "story-website-afab7.firebaseapp.com",
  databaseURL: "https://story-website-afab7-default-rtdb.firebaseio.com",
  projectId: "story-website-afab7",
  storageBucket: "story-website-afab7.firebasestorage.app",
  messagingSenderId: "207838308502",
  appId: "1:207838308502:web:fa12c413c45207f0bdbab7"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// =================================================================
// 2. UNIVERSAL LOGIC (Works on all pages)
// =================================================================

// Apply Dark Mode Theme from Local Storage
function applyTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }
    const themeSwitcher = document.querySelector('.theme-switcher');
    if (themeSwitcher) {
        themeSwitcher.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }
}

// =================================================================
// 3. PAGE ROUTER (Decides which code to run based on the page)
// =================================================================
window.addEventListener('DOMContentLoaded', () => {
    applyTheme(); // Apply theme on every page

    const path = window.location.pathname;

    if (path === '/' || path.endsWith('index.html')) {
        loadHomepageStories();
    } else if (path.endsWith('story.html')) {
        loadSingleStory();
    } else if (path.endsWith('admin.html')) {
        const auth = firebase.auth();
        setupAdminPage(auth);
    }
});

// =================================================================
// 4. PUBLIC PAGE FUNCTIONS (Homepage and Story Page)
// =================================================================

async function loadHomepageStories() {
    const storyListDiv = document.getElementById('story-list');
    storyListDiv.innerHTML = '<p>Loading stories...</p>';
    try {
        const snapshot = await db.collection('stories').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            storyListDiv.innerHTML = '<p>No stories found. Be the first to add one!</p>';
            return;
        }
        let storiesHTML = '';
        snapshot.forEach(doc => {
            const story = doc.data();
            storiesHTML += `
                <a href="story.html?slug=${story.slug}" class="card">
                    <img src="${story.coverImage}" alt="${story.title}">
                    <div class="card-content">
                        <h2>${story.title}</h2>
                        <p>by ${story.author}</p>
                    </div>
                </a>
            `;
        });
        storyListDiv.innerHTML = storiesHTML;
    } catch (error) {
        console.error("Homepage Error:", error);
        storyListDiv.innerHTML = '<p>Error loading stories. An administrator may need to create a Firestore Index. Check the console (F12) for a link.</p>';
    }
}

async function loadSingleStory() {
    const storyContainer = document.getElementById('story-container');
    const slug = new URLSearchParams(window.location.search).get('slug');
    if (!slug) { storyContainer.innerHTML = '<h1>Story not found.</h1>'; return; }
    try {
        const storyQuery = await db.collection('stories').where('slug', '==', slug).get();
        if (storyQuery.empty) { storyContainer.innerHTML = '<h1>Story not found.</h1>'; return; }
        const storyDoc = storyQuery.docs[0];
        const story = storyDoc.data();
        document.title = `${story.title} | Golpo Adda`;
        const chaptersQuery = await db.collection('stories').doc(storyDoc.id).collection('chapters').orderBy('order').get();
        let chaptersHTML = '';
        chaptersQuery.forEach(doc => {
            const chapter = doc.data();
            chaptersHTML += `<div class="chapter"><h2>Chapter ${chapter.order}: ${chapter.title}</h2><p>${chapter.content.replace(/\n/g, '<br>')}</p></div>`;
        });
        storyContainer.innerHTML = `<div class="story-header"><h1>${story.title}</h1><p>by ${story.author}</p><img src="${story.coverImage}" alt="${story.title}"></div><div class="story-content">${chaptersHTML || '<p>This story has no chapters yet.</p>'}</div>`;
    } catch (error) { console.error("Story Page Error:", error); storyContainer.innerHTML = '<h1>Error loading story. Check the console (F12).</h1>'; }
}

// =================================================================
// 5. SECURE ADMIN PANEL LOGIC
// =================================================================

function setupAdminPage(auth) {
    const loginContainer = document.getElementById('login-container');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');

    auth.onAuthStateChanged(user => {
        if (user) {
            loginContainer.style.display = 'none';
            adminPanel.style.display = 'block';
            runAdminLogic();
        } else {
            loginContainer.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => { console.error("Login Error:", error); alert("Login failed: " + error.message); });
    });

    logoutButton.addEventListener('click', () => { auth.signOut(); });
}

function runAdminLogic() {
    const createStoryForm = document.getElementById('create-story-form');
    const addChapterForm = document.getElementById('add-chapter-form');
    const storySelect = document.getElementById('story-select');
    const manageStoryList = document.getElementById('manage-story-list');

    async function loadStoriesForAdmin() {
        try {
            const snapshot = await db.collection('stories').orderBy('createdAt', 'desc').get();
            storySelect.innerHTML = '<option value="">-- Select a Story --</option>';
            manageStoryList.innerHTML = '';
            snapshot.forEach(doc => {
                const story = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = story.title;
                storySelect.appendChild(option);
                const item = document.createElement('div');
                item.className = 'panel admin-story-item';
                item.innerHTML = `<div><strong>${story.title}</strong><br><small>by ${story.author}</small></div><button class="btn-danger" data-id="${doc.id}">Delete</button>`;
                manageStoryList.appendChild(item);
            });
        } catch(error) {
            console.error("Admin Load Error:", error);
            alert("Error loading stories. You likely need to create an index in Firestore. Check the console (F12) for a link to create it.")
        }
    }

    createStoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;
        const author = document.getElementById('author').value;
        const coverImage = document.getElementById('coverImage').value;

        if (!title || !author || !coverImage) { alert("Please fill out all fields before creating a story."); return; }

        try {
            await db.collection('stories').add({
                title, author, coverImage,
                slug: title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert('Story created successfully!');
            createStoryForm.reset();
            loadStoriesForAdmin();
        } catch (error) {
            console.error("Firebase Create Error:", error);
            alert('Error creating story. The most likely cause is a missing Firestore Index. Check the console (F12) for a link to create it automatically.');
        }
    });

    addChapterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const storyId = storySelect.value;
        if (!storyId) { alert('Please select a story first!'); return; }
        try {
            await db.collection('stories').doc(storyId).collection('chapters').add({
                title: document.getElementById('chapter-title').value,
                content: document.getElementById('chapter-content').value,
                order: parseInt(document.getElementById('chapter-order').value)
            });
            alert('Chapter added successfully!');
            addChapterForm.reset();
        } catch (error) { console.error("Add Chapter Error:", error); alert('Error adding chapter. Check console (F12) for details.'); }
    });

    manageStoryList.addEventListener('click', async (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.id) {
            const storyId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this story? This cannot be undone.')) {
                try {
                    await db.collection('stories').doc(storyId).delete();
                    alert('Story deleted.');
                    loadStoriesForAdmin();
                } catch (error) { console.error("Delete Story Error:", error); alert('Error deleting story. Check console (F12) for details.'); }
            }
        }
    });

    loadStoriesForAdmin();
}