from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, session
import json
import os
from werkzeug.utils import secure_filename
import re # For sanitizing titles

app = Flask(__name__)
# IMPORTANT: Change this to a strong, unique secret key!
app.config['SECRET_KEY'] = 'your_very_secret_key_here_a_much_longer_and_random_string_xyz'
app.config['UPLOAD_FOLDER_VIDEOS'] = 'static/videos'
app.config['UPLOAD_FOLDER_THUMBNAILS'] = 'static/thumbnails'
app.config['ALLOWED_VIDEO_EXTENSIONS'] = {'mp4', 'mov', 'avi', 'mkv', 'webm'}
app.config['ALLOWED_IMAGE_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif'}
app.config['CONTENT_DB_FILE'] = 'data.json' # Path to your content database
app.config['TITLES_DB_FILE'] = 'titles.json' # New: Path to your titles database
app.config['USERS_DB_FILE'] = 'users.json'

# Admin credentials for demonstration (INSECURE FOR PRODUCTION)
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'admin' # This should be hashed in a real app!

# Ensure upload directories exist
os.makedirs(app.config['UPLOAD_FOLDER_VIDEOS'], exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER_THUMBNAILS'], exist_ok=True)

def allowed_file(filename, allowed_extensions):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

def slugify(text):
    """Converts text to a URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'\s+', '_', text) # Replace spaces with underscores
    text = re.sub(r'[^a-z0-9_]', '', text) # Remove non-alphanumeric characters except underscore
    text = re.sub(r'__+', '_', text) # Replace multiple underscores with a single one
    return text.strip('_')

# --- Content Data Management ---
def load_content_data():
    """Loads content from the JSON database file."""
    if not os.path.exists(app.config['CONTENT_DB_FILE']):
        # Initialize with empty categories if file doesn't exist
        with open(app.config['CONTENT_DB_FILE'], 'w') as f:
            json.dump({
                "trending": [], "comedies": [], "action": [],
                "drama": [], "sci-fi": [], "horror": []
            }, f, indent=4)
    with open(app.config['CONTENT_DB_FILE'], 'r') as f:
        return json.load(f)

def save_content_data(data):
    """Saves content to the JSON database file."""
    with open(app.config['CONTENT_DB_FILE'], 'w') as f:
        json.dump(data, f, indent=4)

# --- Titles Data Management ---
def load_titles_data():
    """Loads titles from the JSON database file."""
    if not os.path.exists(app.config['TITLES_DB_FILE']):
        with open(app.config['TITLES_DB_FILE'], 'w') as f:
            json.dump({"titles": []}, f, indent=4)
    with open(app.config['TITLES_DB_FILE'], 'r') as f:
        return json.load(f)

def save_titles_data(data):
    """Saves titles to the JSON database file."""
    with open(app.config['TITLES_DB_FILE'], 'w') as f:
        json.dump(data, f, indent=4)

def load_users_data():
    if not os.path.exists(app.config['USERS_DB_FILE']):
        with open(app.config['USERS_DB_FILE'], 'w') as f:
            json.dump({'users': []}, f, indent=4)
    with open(app.config['USERS_DB_FILE'], 'r') as f:
        return json.load(f)

def save_users_data(data):
    with open(app.config['USERS_DB_FILE'], 'w') as f:
        json.dump(data, f, indent=4)

@app.route('/')
def index():
    if 'username' not in session:
        return redirect(url_for('login'))
    users = load_users_data()['users']
    user = next((u for u in users if u['username'] == session['username']), None)
    if not user:
        # Deleted account, clear session
        session.pop('username', None)
        flash('Account not found. Please log in.', 'error')
        return redirect(url_for('login'))
    if user.get('subscription') != 'CopyWatch':
        flash('You need an active subscription to access this page.', 'error')
        return render_template('subscription_required.html')
    return render_template('index.html')

@app.route('/api/content')
def get_content():
    content_data = load_content_data()
    content_with_urls = {}
    for category, items in content_data.items():
        content_with_urls[category] = []
        for item in items:
            # Construct full URLs for video and thumbnail using url_for
            video_full_path = url_for('static', filename=f'videos/{item["video_filename"]}')
            thumbnail_full_path = url_for('static', filename=f'thumbnails/{item["thumbnail_filename"]}')
            content_with_urls[category].append({
                "id": item["id"],
                "title": item["title"],
                "slug": item["slug"], # Include slug for identification
                "video_path": video_full_path,
                "thumbnail_path": thumbnail_full_path,
                "category": item["category"],
                "type": item.get("type", "show"),
                "season": item.get("season"),
                "episode": item.get("episode")
            })
    return jsonify(content_with_urls)

@app.route('/api/titles')
def get_titles():
    titles_data = load_titles_data()
    return jsonify(titles_data['titles'])

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        users = load_users_data()['users']
        if any(u['username'] == username for u in users):
            flash('Username already exists', 'error')
            return redirect(url_for('register'))
        users.append({'username': username,
                      'password': password,
                      'subscription': None,
                      'request_status': None})
        save_users_data({'users': users})
        flash('Registered successfully! Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('login_register.html', action='register')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        users = load_users_data()['users']
        user = next((u for u in users if u['username'] == username and u['password'] == password), None)
        if not user:
            flash('Invalid credentials', 'error')
            return redirect(url_for('login'))
        session['username'] = username
        # Show subscription request feedback
        if user.get('request_status') == 'denied':
            flash('Your subscription request was denied.', 'error')
            user['request_status'] = None
            save_users_data({'users': users})
        elif user.get('request_status') == 'approved':
            user['subscription'] = 'CopyWatch'
            user['request_status'] = None
            save_users_data({'users': users})
            flash('Your subscription request has been approved!', 'success')
        return redirect(url_for('index'))
    return render_template('login_register.html', action='login')

@app.route('/logout')
def logout():
    session.pop('username', None)
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

@app.route('/request_subscription')
def request_subscription():
    if 'username' not in session:
        return redirect(url_for('login'))
    users = load_users_data()['users']
    user = next(u for u in users if u['username'] == session['username'])
    user['request_status'] = 'pending'
    save_users_data({'users': users})
    flash('Subscription request submitted.', 'info')
    return redirect(url_for('index'))

@app.route('/admin/subscriptions', methods=['GET', 'POST'])
def admin_subscriptions():
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))
    users = load_users_data()['users']
    pending = [u for u in users if u.get('request_status') == 'pending']
    approved = [u for u in users if u.get('subscription') == 'CopyWatch']
    if request.method == 'POST':
        username = request.form['username']
        action = request.form['action']  # 'approve', 'deny', 'revoke', or 'delete'
        updated_users = []
        for u in users:
            if u['username'] != username:
                updated_users.append(u)
            else:
                if action == 'approve':
                    u['subscription'] = 'CopyWatch'
                    u['request_status'] = None
                    updated_users.append(u)
                elif action == 'deny':
                    u['request_status'] = 'denied'
                    updated_users.append(u)
                elif action == 'revoke':
                    u['subscription'] = None
                    u['request_status'] = None
                    updated_users.append(u)
                elif action == 'delete':
                    # Skip adding = delete account
                    pass
        save_users_data({'users': updated_users})
        flash(f"{username} has been {action}d.", 'info')
        return redirect(url_for('admin_subscriptions'))
    return render_template('admin_subscriptions.html', pending=pending, approved=approved)

@app.route('/admin_login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['logged_in'] = True
            flash('Logged in successfully!', 'success')
            return redirect(url_for('admin'))
        else:
            flash('Invalid credentials. Please try again.', 'error')
            return render_template('admin_login.html')
    return render_template('admin_login.html')

@app.route('/admin_logout')
def admin_logout():
    session.pop('logged_in', None)
    flash('You have been logged out.', 'info')
    return redirect(url_for('admin_login'))

@app.route('/admin', methods=['GET', 'POST'])
def admin():
    if not session.get('logged_in'):
        return redirect(url_for('admin_login'))

    if request.method == 'POST':
        # Determine if adding a new title or selecting existing
        action = request.form.get('title_action') # 'new' or 'existing'
        title = ''
        title_slug = ''
        
        if action == 'new':
            new_title_name = request.form.get('new_title_name')
            if not new_title_name:
                flash('New title name is required!', 'error')
                return redirect(request.url)
            title = new_title_name
            title_slug = slugify(new_title_name)

            titles_data = load_titles_data()
            if any(t['slug'] == title_slug for t in titles_data['titles']):
                flash(f'Title "{new_title_name}" already exists! Please select it from the dropdown or choose a different name.', 'error')
                return redirect(request.url)
            
            # Add new title to titles.json
            titles_data['titles'].append({'name': title, 'slug': title_slug})
            save_titles_data(titles_data)
            flash(f'New title "{title}" added!', 'info') # Inform user about new title addition

        elif action == 'existing':
            existing_title_slug = request.form.get('existing_title_slug')
            if not existing_title_slug:
                flash('Please select an existing title!', 'error')
                return redirect(request.url)
            
            titles_data = load_titles_data()
            found_title = next((t for t in titles_data['titles'] if t['slug'] == existing_title_slug), None)
            if not found_title:
                flash('Selected title not found in database!', 'error')
                return redirect(request.url)
            title = found_title['name']
            title_slug = found_title['slug']
        else:
            flash('Invalid title action!', 'error')
            return redirect(request.url)

        category = request.form.get('category').lower()
        content_type = request.form.get('content_type')
        season = request.form.get('season')
        episode = request.form.get('episode')

        video_file = request.files.get('video_file')
        thumbnail_file = request.files.get('thumbnail_file')

        if not category or not content_type or not video_file or not thumbnail_file:
            flash('All fields (Category, Type, Video File, Thumbnail) are required!', 'error')
            return redirect(request.url)

        # Validate season/episode for shows
        if content_type == 'show':
            if not season or not episode or not season.isdigit() or not episode.isdigit():
                flash('Season and Episode are required and must be numbers for a Show!', 'error')
                return redirect(request.url)
            season = int(season)
            episode = int(episode)
            # Generate filenames based on show slug, season, and episode
            video_filename_base = f"{title_slug}_s{season:02d}_e{episode:02d}"
            thumbnail_filename_base = f"{title_slug}_s{season:02d}_e{episode:02d}"
        else: # For movies, clear season/episode and use movie slug
            season = None
            episode = None
            video_filename_base = title_slug
            thumbnail_filename_base = title_slug
        
        # Get actual file extensions
        video_ext = video_file.filename.rsplit('.', 1)[1].lower() if video_file.filename else ''
        thumbnail_ext = thumbnail_file.filename.rsplit('.', 1)[1].lower() if thumbnail_file.filename else ''

        video_filename = f"{video_filename_base}.{video_ext}"
        thumbnail_filename = f"{thumbnail_filename_base}.{thumbnail_ext}"

        if video_file.filename == '' or thumbnail_file.filename == '':
            flash('No selected file for video or thumbnail', 'error')
            return redirect(request.url)

        try:
            if video_file and allowed_file(video_file.filename, app.config['ALLOWED_VIDEO_EXTENSIONS']):
                video_file.save(os.path.join(app.config['UPLOAD_FOLDER_VIDEOS'], video_filename))
            else:
                flash('Invalid video file type or no video file selected!', 'error')
                return redirect(request.url)

            if thumbnail_file and allowed_file(thumbnail_file.filename, app.config['ALLOWED_IMAGE_EXTENSIONS']):
                thumbnail_file.save(os.path.join(app.config['UPLOAD_FOLDER_THUMBNAILS'], thumbnail_filename))
            else:
                flash('Invalid thumbnail file type or no thumbnail file selected!', 'error')
                if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER_VIDEOS'], video_filename)):
                    os.remove(os.path.join(app.config['UPLOAD_FOLDER_VIDEOS'], video_filename))
                return redirect(request.url)

        except Exception as e:
            flash(f'File upload error: {e}', 'error')
            if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER_VIDEOS'], video_filename)):
                os.remove(os.path.join(app.config['UPLOAD_FOLDER_VIDEOS'], video_filename))
            if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER_THUMBNAILS'], thumbnail_filename)):
                os.remove(os.path.join(app.config['UPLOAD_FOLDER_THUMBNAILS'], thumbnail_filename))
            return redirect(request.url)


        content_data = load_content_data()

        max_id = 0
        for cat_items in content_data.values():
            for item in cat_items:
                if 'id' in item and item['id'] > max_id:
                    max_id = item['id']
        new_id = max_id + 1

        new_content_item = {
            "id": new_id,
            "title": title, # Full title
            "slug": title_slug, # Slug for internal use
            "video_filename": video_filename,
            "thumbnail_filename": thumbnail_filename,
            "category": category,
            "type": content_type,
            "season": season,
            "episode": episode
        }

        if category not in content_data:
            content_data[category] = []

        # Before appending, check for duplicates based on slug, type, season, episode
        # This prevents uploading the exact same episode/movie twice
        is_duplicate = False
        for existing_item in content_data[category]:
            if (existing_item['slug'] == new_content_item['slug'] and
                existing_item['type'] == new_content_item['type']):
                if new_content_item['type'] == 'show':
                    if (existing_item.get('season') == new_content_item['season'] and
                        existing_item.get('episode') == new_content_item['episode']):
                        is_duplicate = True
                        break
                elif new_content_item['type'] == 'movie':
                    is_duplicate = True # Only one movie per slug
                    break

        if is_duplicate:
            flash(f'This {content_type} ({title} - S{season:02d}E{episode:02d} if show) already exists in "{category}" category!', 'error')
            # Clean up uploaded files if it's a duplicate
            if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER_VIDEOS'], video_filename)):
                os.remove(os.path.join(app.config['UPLOAD_FOLDER_VIDEOS'], video_filename))
            if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER_THUMBNAILS'], thumbnail_filename)):
                os.remove(os.path.join(app.config['UPLOAD_FOLDER_THUMBNAILS'], thumbnail_filename))
            return redirect(request.url)

        content_data[category].append(new_content_item)
        save_content_data(content_data)

        flash('Content uploaded successfully!', 'success')
        return redirect(url_for('admin'))

    return render_template('admin.html')


if __name__ == '__main__':
    load_users_data()
    load_content_data()
    load_titles_data()
    app.run(debug=True)