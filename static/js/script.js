// Video Player Elements
const videoPlayer = document.getElementById('videoPlayer');
const homepage = document.getElementById('homepage');
const backButton = document.getElementById('backButton');
const video = document.getElementById('video');
const overlayIcon = document.getElementById('overlayIcon');
const loadingSpinner = document.getElementById('loadingSpinner');
const nextEpisodeBtn = document.getElementById('nextEpisodeBtn');
const subtitleConfirmation = document.getElementById('subtitleConfirmation');
const subtitleDisplay = document.getElementById('subtitleDisplay');

// Controls Elements
const playpause = document.getElementById('playpause');
const rewind = document.getElementById('rewind');
const forward = document.getElementById('forward');
const mute = document.getElementById('mute');
const progress = document.getElementById('progress');
const thumb = document.getElementById('thumb');
const progressContainer = document.getElementById('progress-container');
const time = document.getElementById('time');
const pip = document.getElementById('pip');
const fullscreen = document.getElementById('fullscreen');
const cc = document.getElementById('cc');
const subtitleFile = document.getElementById('subtitleFile');
const speed = document.getElementById('speed');
const videoTitle = document.getElementById('videoTitle');
const volumeContainer = document.getElementById('volume-container');
const volumeBar = document.getElementById('volume-bar');
const volumeThumb = document.getElementById('volume-thumb');

// Navigation
const watchNowHero = document.getElementById('watchNowHero');
const logo = document.getElementById('logo');

// Dynamic Content Section
const dynamicContentSections = document.getElementById('dynamic-content-sections');

// Global state variables for currently playing content
let currentPlayingShowId = null;
let currentPlayingEpisode = null;
let currentPlayingSeason = null;
let currentPlayingContentType = null;
let currentPlayingSlug = null; // NEW: To track the show/movie slug

// Stores all loaded content for next/previous logic
let currentContentList = {}; 

// Array to hold parsed subtitle cues
let parsedSubtitles = [];

// --- Utility Functions ---

function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function showOverlayIcon(icon) {
    overlayIcon.textContent = icon;
    overlayIcon.classList.add('show');
    setTimeout(() => overlayIcon.classList.remove('show'), 500);
}

function showSubtitleConfirmation(filename) {
    subtitleConfirmation.textContent = `${filename} has been implemented`;
    subtitleConfirmation.classList.add('show');
    setTimeout(() => {
        subtitleConfirmation.classList.remove('show');
        subtitleConfirmation.textContent = '';
    }, 3000);
}

// Function to parse SRT data into an array of subtitle objects
function parseSrt(srtData) {
    const cues = [];
    const lines = srtData.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
        // Skip empty lines or numbers (until we find a timecode)
        if (lines[i].trim() === '' || /^\d+$/.test(lines[i].trim())) {
            i++;
            continue;
        }

        // Time code line
        const timecodeLine = lines[i].trim();
        const match = timecodeLine.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (!match) {
            console.warn("Skipping malformed timecode line:", timecodeLine);
            i++;
            continue;
        }

        const [
            fullMatch,
            startH, startM, startS, startMs,
            endH, endM, endS, endMs
        ] = match;

        const startTime = parseInt(startH) * 3600 +
                            parseInt(startM) * 60 +
                            parseInt(startS) +
                            parseInt(startMs) / 1000;

        const endTime = parseInt(endH) * 3600 +
                            parseInt(endM) * 60 +
                            parseInt(endS) +
                            parseInt(endMs) / 1000;

        i++; // Move to the text lines

        let text = [];
        while (i < lines.length && lines[i].trim() !== '') {
            text.push(lines[i].trim());
            i++;
        }

        cues.push({
            start: startTime,
            end: endTime,
            text: text.join('<br>')
        });

        i++; // Move past the blank line after the cue
    }
    return cues;
}

// Function to update the subtitle display based on current video time
function updateSubtitleDisplay(currentTime) {
    let currentSubtitle = '';
    for (let i = 0; i < parsedSubtitles.length; i++) {
        const cue = parsedSubtitles[i];
        if (currentTime >= cue.start && currentTime < cue.end) {
            currentSubtitle = cue.text;
            break;
        }
    }
    subtitleDisplay.innerHTML = currentSubtitle;
    
    // Toggle opacity based on whether there's text
    if (currentSubtitle) {
        subtitleDisplay.style.opacity = '1';
    } else {
        subtitleDisplay.style.opacity = '0';
    }
}

// Function to update mute icon based on video.muted state
function updateMuteIcon() {
    mute.innerHTML = video.muted ? 
        '<path d="M12 4a8 8 0 00-8 8" stroke="white" stroke-width="2" fill="none"/><path d="M5 9v6h4l5 5V4L9 9H5z" stroke="white" stroke-width="2" fill="none"/>' : 
        '<path d="M5 9v6h4l5 5V4L9 9H5z" stroke="white" stroke-width="2" fill="none"/>';
}


// --- Content Loading and Playback Logic ---

// Function to dynamically load and display content from API
async function loadDynamicContent() {
    try {
        const response = await fetch('/api/content');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        currentContentList = await response.json(); // Store for next/previous logic

        dynamicContentSections.innerHTML = ''; // Clear existing content

        // To ensure consistent sorting of items within categories if needed,
        // especially for shows to appear in S1E1, S1E2 order.
        const sortedContentList = {};
        for (const category in currentContentList) {
            sortedContentList[category] = currentContentList[category].sort((a, b) => {
                if (a.type === 'show' && b.type === 'show' && a.slug === b.slug) {
                    // Only sort by season/episode if it's the same show
                    if (a.season !== b.season) return a.season - b.season;
                    return a.episode - b.episode;
                }
                // For movies or different shows, maintain original order
                return 0; 
            });
        }


        for (const category in sortedContentList) { // Use sortedContentList
            const section = document.createElement('section');
            section.classList.add('lolomo');
            
            const title = document.createElement('h2');
            title.classList.add('row-title');
            title.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            section.appendChild(title);

            const rowContainer = document.createElement('div');
            rowContainer.classList.add('row-container');

            sortedContentList[category].forEach(item => { // Use sortedContentList
                const box = document.createElement('div');
                box.classList.add('box');
                box.dataset.id = item.id;
                box.dataset.video = item.video_path;
                box.dataset.thumbnail = item.thumbnail_path;
                box.dataset.title = item.title;
                box.dataset.type = item.type;
                box.dataset.slug = item.slug; // NEW: Add slug to dataset
                
                if (item.type === 'show' && item.season && item.episode) {
                    box.dataset.season = item.season;
                    box.dataset.episode = item.episode;
                }

                const img = document.createElement('img');
                img.src = item.thumbnail_path;
                img.alt = item.title;
                box.appendChild(img);

                const titleDiv = document.createElement('div');
                titleDiv.classList.add('title');
                titleDiv.textContent = item.title;
                if (item.type === 'show' && item.season && item.episode) {
                     titleDiv.textContent += ` S${item.season.toString().padStart(2, '0')}E${item.episode.toString().padStart(2, '0')}`;
                }
                box.appendChild(titleDiv);

                rowContainer.appendChild(box);
            });
            section.appendChild(rowContainer);
            dynamicContentSections.appendChild(section);
        }

        // Attach event listeners to newly created boxes
        document.querySelectorAll('.box').forEach(box => {
            box.addEventListener('click', () => {
                const videoUrl = box.dataset.video;
                const title = box.dataset.title;
                const type = box.dataset.type;
                const id = parseInt(box.dataset.id);
                const slug = box.dataset.slug; // NEW: Get slug from dataset
                const season = box.dataset.season ? parseInt(box.dataset.season) : null;
                const episode = box.dataset.episode ? parseInt(box.dataset.episode) : null;

                playContent(id, videoUrl, title, type, slug, season, episode); // Pass slug
            });
        });

    } catch (error) {
        console.error('Failed to load dynamic content:', error);
        dynamicContentSections.innerHTML = '<p style="color:red; text-align:center;">Failed to load content. Please check the server and ensure data.json is properly formatted.</p>';
    }
}

// Consolidated function to play any content type
// NEW: Added slug parameter
function playContent(id, src, title, type, slug, season = null, episode = null) {
    homepage.style.display = 'none';
    videoPlayer.style.display = 'flex';
    video.src = src;
    videoTitle.textContent = title;
    if (type === 'show' && season && episode) {
        videoTitle.textContent += ` S${season.toString().padStart(2, '0')}E${episode.toString().padStart(2, '0')}`;
    }
    video.load();
    video.play().catch(err => console.error('Playback error:', err));
    
    currentPlayingShowId = id;
    currentPlayingContentType = type;
    currentPlayingSlug = slug; // NEW: Set current playing slug
    currentPlayingSeason = season;
    currentPlayingEpisode = episode;

    nextEpisodeBtn.classList.remove('show'); // Hide until needed
    subtitleDisplay.textContent = '';
    subtitleDisplay.style.opacity = '0';
    parsedSubtitles = [];
    updateMuteIcon();
}

// --- Video Player Event Listeners ---

// Play/Pause Toggle
function togglePlay() {
    if (video.paused) {
        video.play();
        playpause.innerHTML = '<rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />';
        showOverlayIcon('▶️');
    } else {
        video.pause();
        playpause.innerHTML = '<path d="M8 5v14l11-7-11-7z" fill="white"/>';
        showOverlayIcon('⏸️');
    }
}
playpause.addEventListener('click', togglePlay);
video.addEventListener('click', togglePlay);


// Time Update (for progress bar, time display, and next episode button)
video.addEventListener('timeupdate', () => {
    const bufferTime = 30; // Show button 30 seconds before end
    
    // Logic for "Next Episode" button
    if (currentPlayingContentType === 'show' && currentPlayingSlug !== null && video.duration && video.duration - video.currentTime <= bufferTime) {
        let foundNextEpisode = false;
        // Iterate through all categories to find the next episode
        for (const category in currentContentList) {
            const itemsInCategory = currentContentList[category];
            // Filter to find items of the same show (by slug)
            const showEpisodes = itemsInCategory.filter(item => item.slug === currentPlayingSlug && item.type === 'show');
            
            // Sort episodes for reliable "next" finding
            showEpisodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });

            const currentEpisodeIndex = showEpisodes.findIndex(item => 
                item.season === currentPlayingSeason && item.episode === currentPlayingEpisode
            );

            if (currentEpisodeIndex !== -1) {
                const nextEpisodeCandidate = showEpisodes[currentEpisodeIndex + 1];
                if (nextEpisodeCandidate) {
                    // Check if it's indeed the logically next episode
                    // (e.g., S1E1 followed by S1E2, or S1E10 followed by S2E1 if your data supports season changes)
                    if (nextEpisodeCandidate.season === currentPlayingSeason && nextEpisodeCandidate.episode === currentPlayingEpisode + 1) {
                        nextEpisodeBtn.classList.add('show');
                        foundNextEpisode = true;
                        break; // Found the next episode, no need to check other categories
                    }
                    // Add more complex logic here if you want to handle season transitions
                    // e.g., if (nextEpisodeCandidate.season === currentPlayingSeason + 1 && nextEpisodeCandidate.episode === 1) { /* logic */ }
                }
            }
        }
        if (!foundNextEpisode) {
            nextEpisodeBtn.classList.remove('show');
        }
    } else {
        nextEpisodeBtn.classList.remove('show');
    }

    const percent = (video.currentTime / video.duration) * 100;
    progress.style.width = `${percent}%`;
    thumb.style.left = `${percent}%`;
    time.textContent = formatTime(video.currentTime);

    updateSubtitleDisplay(video.currentTime);
});

// Buffering Events
video.addEventListener('waiting', () => {
    loadingSpinner.style.display = 'block';
    console.log('Video is buffering...');
});

video.addEventListener('playing', () => {
    loadingSpinner.style.display = 'none';
    console.log('Video is playing.');
});

video.addEventListener('canplay', () => {
    loadingSpinner.style.display = 'none';
    console.log('Video can play.');
});

video.addEventListener('loadeddata', () => {
    console.log('Video metadata and first frame loaded.');
    loadingSpinner.style.display = 'none';
});

video.addEventListener('error', (e) => {
    console.error('Video error:', e.message || e.srcElement.error);
    loadingSpinner.style.display = 'none';
    alert('End of movie/show or show was interrupted. If not, please contact a developer.');
});

// Rewind / Forward
rewind.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
    showOverlayIcon('⏪');
});
forward.addEventListener('click', () => {
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
    showOverlayIcon('⏩');
});

// Mute/Unmute
mute.addEventListener('click', () => {
    video.muted = !video.muted;
    updateMuteIcon();
    showOverlayIcon(video.muted ? '🔇' : '🔊');
});

// Volume Control
let isDraggingVolume = false;

function updateVolume(e) {
    const rect = volumeContainer.getBoundingClientRect();
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    video.volume = percent;
    video.muted = video.volume === 0; // Ensure mute state reflects volume
    volumeBar.style.width = `${percent * 100}%`;
    volumeThumb.style.left = `${percent * 100}%`;
    updateMuteIcon();
}

volumeContainer.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    updateVolume(e);
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) {
        updateVolume(e);
    }
});

document.addEventListener('mouseup', () => {
    isDraggingVolume = false;
});

video.addEventListener('volumechange', () => {
    const percent = video.volume;
    volumeBar.style.width = `${percent * 100}%`;
    volumeThumb.style.left = `${percent * 100}%`;
    updateMuteIcon();
});

// Progress Bar Seeking (SCRUBBING)
let isDraggingProgress = false;

progressContainer.addEventListener('mousedown', (e) => {
    isDraggingProgress = true;
    updateProgress(e);
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingProgress) {
        updateProgress(e);
    }
});

document.addEventListener('mouseup', () => {
    isDraggingProgress = false;
});

function updateProgress(e) {
    const rect = progressContainer.getBoundingClientRect();
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.max(0, Math.min(1, percent));
    video.currentTime = percent * video.duration;
}

// Picture-in-Picture
pip.addEventListener('click', async () => {
    if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
    } else {
        await video.requestPictureInPicture();
    }
});

// Fullscreen
fullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

// Subtitle (Closed Captions)
cc.addEventListener('click', () => {
    subtitleFile.click();
});

// Handle subtitle file selection and parsing
subtitleFile.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                parsedSubtitles = parseSrt(e.target.result);
                console.log('Parsed subtitles:', parsedSubtitles);
                showSubtitleConfirmation(file.name);
                if (video.paused) {
                    video.play();
                }
            } catch (error) {
                console.error("Error parsing SRT file:", error);
                alert("Failed to load subtitles. Please ensure it's a valid SRT file.");
                parsedSubtitles = [];
                subtitleDisplay.textContent = '';
                subtitleDisplay.style.opacity = '0';
            }
        };
        reader.readAsText(file);
    }
});

// Playback Speed
let speeds = [1, 1.5, 2, 0.5];
let currentSpeedIndex = 0;
speed.addEventListener('click', () => {
    currentSpeedIndex = (currentSpeedIndex + 1) % speeds.length;
    video.playbackRate = speeds[currentSpeedIndex];
    speed.innerHTML = `<text x="4" y="16" fill="white" font-size="14" font-family="sans-serif">${speeds[currentSpeedIndex]}x</text>`;
    showOverlayIcon(`${speeds[currentSpeedIndex]}x`);
});

// Next Episode Button Handler
nextEpisodeBtn.addEventListener('click', () => {
    if (currentPlayingContentType === 'show' && currentPlayingSlug !== null) {
        let nextContent = null;
        for (const category in currentContentList) {
            const itemsInCategory = currentContentList[category];
            const showEpisodes = itemsInCategory.filter(item => item.slug === currentPlayingSlug && item.type === 'show');
            
            showEpisodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });

            const currentEpisodeIndex = showEpisodes.findIndex(item => 
                item.season === currentPlayingSeason && item.episode === currentPlayingEpisode
            );

            if (currentEpisodeIndex !== -1) {
                const nextEpisodeCandidate = showEpisodes[currentEpisodeIndex + 1];
                if (nextEpisodeCandidate && 
                    nextEpisodeCandidate.season === currentPlayingSeason && 
                    nextEpisodeCandidate.episode === currentPlayingEpisode + 1) {
                    nextContent = nextEpisodeCandidate;
                    break;
                }
            }
        }
        
        if (nextContent) {
            playContent(nextContent.id, nextContent.video_path, nextContent.title, nextContent.type, nextContent.slug, nextContent.season, nextContent.episode);
            nextEpisodeBtn.classList.remove('show');
        } else {
            console.warn("No next episode found for this show/season.");
            // If no next episode, return to homepage
            video.pause();
            video.currentTime = 0;
            video.src = '';
            nextEpisodeBtn.classList.remove('show');
            homepage.style.display = 'block';
            videoPlayer.style.display = 'none';
            subtitleDisplay.textContent = '';
            subtitleDisplay.style.opacity = '0';
            parsedSubtitles = [];
            currentPlayingShowId = null;
            currentPlayingEpisode = null;
            currentPlayingSeason = null;
            currentPlayingContentType = null;
            currentPlayingSlug = null;
        }
    }
});

// Video Ended Event
video.addEventListener('ended', () => {
    if (currentPlayingContentType === 'show' && currentPlayingSlug !== null) {
        let nextContent = null;
        for (const category in currentContentList) {
            const itemsInCategory = currentContentList[category];
            const showEpisodes = itemsInCategory.filter(item => item.slug === currentPlayingSlug && item.type === 'show');
            
            showEpisodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.episode - b.episode;
            });

            const currentEpisodeIndex = showEpisodes.findIndex(item => 
                item.season === currentPlayingSeason && item.episode === currentPlayingEpisode
            );

            if (currentEpisodeIndex !== -1) {
                const nextEpisodeCandidate = showEpisodes[currentEpisodeIndex + 1];
                if (nextEpisodeCandidate && 
                    nextEpisodeCandidate.season === currentPlayingSeason && 
                    nextEpisodeCandidate.episode === currentPlayingEpisode + 1) {
                    nextContent = nextEpisodeCandidate;
                    break;
                }
            }
        }

        if (nextContent) {
            playContent(nextContent.id, nextContent.video_path, nextContent.title, nextContent.type, nextContent.slug, nextContent.season, nextContent.episode);
        } else {
            // End of series/season, or no more episodes in this category
            video.pause();
            video.currentTime = 0;
            video.src = '';
            nextEpisodeBtn.classList.remove('show');
            homepage.style.display = 'block';
            videoPlayer.style.display = 'none';
            subtitleDisplay.textContent = '';
            subtitleDisplay.style.opacity = '0';
            parsedSubtitles = [];
            currentPlayingShowId = null;
            currentPlayingEpisode = null;
            currentPlayingSeason = null;
            currentPlayingContentType = null;
            currentPlayingSlug = null;
        }
    } else { // It's a movie or last episode of a show
        video.pause();
        video.currentTime = 0;
        video.src = '';
        nextEpisodeBtn.classList.remove('show');
        homepage.style.display = 'block';
        videoPlayer.style.display = 'none';
        subtitleDisplay.textContent = '';
        subtitleDisplay.style.opacity = '0';
        parsedSubtitles = [];
        currentPlayingShowId = null;
        currentPlayingEpisode = null;
        currentPlayingSeason = null;
        currentPlayingContentType = null;
        currentPlayingSlug = null;
    }
});


// --- Global Event Listeners ---

// DOMContentLoaded: Load dynamic content and set up initial state
document.addEventListener('DOMContentLoaded', function () {
    loadDynamicContent(); // Load content when the page is ready

    // Watch Now Hero button (if it directly plays content)
    if (watchNowHero) {
        watchNowHero.addEventListener('click', () => {
            if (currentContentList.trending && currentContentList.trending.length > 0) {
                // Find the first "trending" item to play
                const firstTrending = currentContentList.trending[0];
                playContent(firstTrending.id, firstTrending.video_path, firstTrending.title, firstTrending.type, firstTrending.slug, firstTrending.season, firstTrending.episode);
            } else {
                alert('No content available to play from "Watch Now".');
            }
        });
    }
});

// Logo Click: Return to homepage
logo.addEventListener('click', () => {
    video.pause();
    videoPlayer.style.display = 'none';
    homepage.style.display = 'block';
    subtitleDisplay.textContent = '';
    subtitleDisplay.style.opacity = '0';
    parsedSubtitles = [];
    currentPlayingShowId = null;
    currentPlayingEpisode = null;
    currentPlayingSeason = null;
    currentPlayingContentType = null;
    currentPlayingSlug = null;
});

// Back Button Click: Return to homepage
backButton.addEventListener('click', () => {
    video.pause();
    video.currentTime = 0;
    video.src = '';
    nextEpisodeBtn.classList.remove('show');
    homepage.style.display = 'block';
    videoPlayer.style.display = 'none';
    subtitleDisplay.textContent = '';
    subtitleDisplay.style.opacity = '0';
    parsedSubtitles = [];
    currentPlayingShowId = null;
    currentPlayingEpisode = null;
    currentPlayingSeason = null;
    currentPlayingContentType = null;
    currentPlayingSlug = null;
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (videoPlayer.style.display === 'flex') { // Only active when video player is visible
        switch (e.key) {
            case 'ArrowLeft':
                video.currentTime = Math.max(0, video.currentTime - 10);
                showOverlayIcon('⏪');
                e.preventDefault();
                break;
            case 'ArrowRight':
                video.currentTime = Math.min(video.duration, video.currentTime + 10);
                showOverlayIcon('⏩');
                e.preventDefault();
                break;
            case ' ': // Spacebar
                togglePlay();
                e.preventDefault();
                break;
            case 'm': // Mute/Unmute with 'm' key
                video.muted = !video.muted;
                updateMuteIcon();
                showOverlayIcon(video.muted ? '🔇' : '🔊');
                break;
            case 'f': // Fullscreen with 'f' key
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
                break;
            case 'Escape': // Exit fullscreen with Escape key
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                }
                break;
        }
    }
});

// Initial Load - Make sure the volume is set and mute icon is correct on startup
window.addEventListener('load', () => {
    video.volume = 1; // Set initial volume to 100%
    video.muted = false; // Ensure it's not muted
    // Only attempt to update volume bar if it exists (might not if player not loaded)
    if (volumeContainer) {
        // Simulate a click at the max right of the volume bar to set it to 100% visually
        const rect = volumeContainer.getBoundingClientRect();
        updateVolume({ clientX: rect.left + rect.width }); 
    }
    updateMuteIcon(); // Ensure the mute icon is in the correct (unmuted) state
});

// HERE STARTS


document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('pageSearchInput');

    let currentIndex = 0;
    let matches = [];

    // Highlight all occurrences of the search term
    function highlightText(searchTerm) {
        removeHighlights();
        matches = [];

        if (!searchTerm.trim()) return;

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (
                node.parentElement &&
                !['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA'].includes(node.parentElement.tagName)
            ) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(node => {
            const regex = new RegExp(`(${searchTerm})`, 'gi');
            if (regex.test(node.textContent)) {
                const span = document.createElement('span');
                span.innerHTML = node.textContent.replace(regex, `<mark class="mark">$1</mark>`);
                node.parentNode.replaceChild(span, node);
                matches.push(...span.querySelectorAll('.mark'));
            }
        });

        scrollToMatch(0);
    }

    // Scroll to a specific match
    function scrollToMatch(index) {
        if (matches.length === 0) return;
        const element = matches[index];
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            highlightTemporarily(element);
        }
    }

    // Temporarily highlight the current match
    function highlightTemporarily(element) {
        element.style.transition = 'background-color 0.3s';
        element.style.backgroundColor = '#FFD700'; // gold
        setTimeout(() => {
            element.style.backgroundColor = 'yellow';
        }, 200);
    }

    // Remove all highlights
    function removeHighlights() {
        const marks = document.querySelectorAll('.mark, mark');
        marks.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
        matches = [];
        currentIndex = 0;
    }

    // Handle input changes to reset highlights
    searchInput.addEventListener('input', function () {
        removeHighlights();
    });

    // Handle Enter key to go to next match
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();

            const term = this.value;
            if (!term.trim()) {
                removeHighlights();
                return;
            }

            if (matches.length === 0) {
                highlightText(term); // perform new search
            } else {
                currentIndex = (currentIndex + 1) % matches.length;
                scrollToMatch(currentIndex);
            }
        }
    });

    // Optional: Intercept Ctrl+F and focus this input
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            searchInput.focus();
        }
    });
});