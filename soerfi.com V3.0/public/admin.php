<?php
/**
 * SOERFI.COM - Admin Tool V2.2
 * Robust PHP based management for images and categories.
 * Fixed: Explicit FTP file deletion, Sorting, and Display names.
 */

session_start();

// CONFIGURATION
$ADMIN_PASS = "admin123"; // CHANGE THIS!
$CONFIG_FILE = __DIR__ . "/config.json";
$IMAGES_DIR = __DIR__ . "/images";

// AUTHENTICATION
if (isset($_POST['password'])) {
    if ($_POST['password'] === $ADMIN_PASS) {
        $_SESSION['logged_in'] = true;
    } else {
        $error = "Invalid password.";
    }
}

if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: admin.php");
    exit;
}

if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    echo '<!DOCTYPE html><html><head><title>Admin Login</title><style>body{background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}input{background:#111;border:1px solid #333;color:#fff;padding:10px;width:200px;margin-bottom:10px}button{background:#fff;color:#000;border:none;padding:10px;cursor:pointer;width:220px}</style></head><body>';
    echo '<form method="POST"><h1>SOERFI ADMIN</h1>' . (isset($error) ? "<p style='color:red'>$error</p>" : "") . '<input type="password" name="password" placeholder="Password" autofocus><br><button type="submit">Login</button></form>';
    echo '</body></html>';
    exit;
}

// LOAD DATA
if (!file_exists($CONFIG_FILE)) {
    die("Error: config.json not found. Make sure it is uploaded to the root.");
}
$data = json_decode(file_get_contents($CONFIG_FILE), true);

// HELPERS
function saveConfig($data, $file)
{
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    file_put_contents($file, $json);
}

// HANDLE ACTIONS
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    // AJAX: SORT IMAGES
    if ($action === 'sort') {
        $catId = $_POST['category_id'];
        $orderFiles = explode(',', $_POST['order']);

        foreach ($data['categories'] as &$cat) {
            if (isset($cat['subcategories'])) {
                foreach ($cat['subcategories'] as &$sub) {
                    if ($sub['id'] === $catId) {
                        $newImages = [];
                        foreach ($orderFiles as $f) {
                            foreach ($sub['images'] as $img) {
                                $currFile = is_array($img) ? $img['file'] : $img;
                                if ($currFile === $f) {
                                    $newImages[] = $img;
                                    break;
                                }
                            }
                        }
                        $sub['images'] = $newImages;
                    }
                }
            }
        }
        saveConfig($data, $CONFIG_FILE);
        echo json_encode(["status" => "success"]);
        exit;
    }

    // AJAX: UPDATE NAME
    if ($action === 'update_name') {
        $catId = $_POST['category_id'];
        $file = $_POST['file'];
        $newName = $_POST['name'];

        foreach ($data['categories'] as &$cat) {
            if (isset($cat['subcategories'])) {
                foreach ($cat['subcategories'] as &$sub) {
                    if ($sub['id'] === $catId) {
                        foreach ($sub['images'] as &$img) {
                            $currFile = is_array($img) ? $img['file'] : $img;
                            if ($currFile === $file) {
                                if (!is_array($img)) {
                                    $img = ["file" => $currFile, "name" => $newName];
                                } else {
                                    $img['name'] = $newName;
                                }
                            }
                        }
                    }
                }
            }
        }
        saveConfig($data, $CONFIG_FILE);
        echo json_encode(["status" => "success"]);
        exit;
    }

    // MULTI UPLOAD
    if ($action === 'upload') {
        $catId = $_POST['category_id'];
        $path = $_POST['path'];
        $targetDir = __DIR__ . "/images/$path/";
        if (!is_dir($targetDir))
            mkdir($targetDir, 0777, true);

        if (isset($_FILES['files'])) {
            $files = $_FILES['files'];
            $count = count($files['name']);
            for ($i = 0; $i < $count; $i++) {
                if ($files['error'][$i] === 0) {
                    $fileName = basename($files['name'][$i]);
                    $targetFile = $targetDir . $fileName;
                    if (move_uploaded_file($files['tmp_name'][$i], $targetFile)) {
                        foreach ($data['categories'] as &$cat) {
                            if (isset($cat['subcategories'])) {
                                foreach ($cat['subcategories'] as &$sub) {
                                    if ($sub['id'] === $catId) {
                                        $exists = false;
                                        foreach ($sub['images'] as $img) {
                                            $cf = is_array($img) ? $img['file'] : $img;
                                            if ($cf === $fileName) {
                                                $exists = true;
                                                break;
                                            }
                                        }
                                        if (!$exists) {
                                            $sub['images'][] = ["file" => $fileName, "name" => ""];
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            saveConfig($data, $CONFIG_FILE);
        }
        header("Location: admin.php?success=1");
        exit;
    }

    // DELETE IMAGE
    if ($action === 'delete') {
        $catId = $_POST['category_id'];
        $path = $_POST['path'];
        $fileName = $_POST['filename'];

        // FIX: Explicit path for deletion
        $filePath = __DIR__ . "/images/$path/$fileName";
        if (file_exists($filePath)) {
            @chmod($filePath, 0666); // Ensure we have permission
            @unlink($filePath);
        }

        foreach ($data['categories'] as &$cat) {
            if (isset($cat['subcategories'])) {
                foreach ($cat['subcategories'] as &$sub) {
                    if ($sub['id'] === $catId) {
                        $sub['images'] = array_values(array_filter($sub['images'], function ($img) use ($fileName) {
                            $cf = is_array($img) ? $img['file'] : $img;
                            return $cf !== $fileName;
                        }));
                    }
                }
            }
        }
        saveConfig($data, $CONFIG_FILE);
        header("Location: admin.php?success=1");
        exit;
    }
}

?>
<!DOCTYPE html>
<html>

<head>
    <title>SOERFI | Admin V2.2</title>
    <style>
        body {
            background: #09090b;
            color: #fafafa;
            font-family: 'Inter', sans-serif;
            margin: 0;
            padding: 40px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #18181b;
            padding-bottom: 20px;
            margin-bottom: 40px;
        }

        h1 {
            font-family: 'Archivo', sans-serif;
            font-weight: 900;
            letter-spacing: -0.05em;
            margin: 0;
        }

        .logo-box {
            display: flex;
            align-items: center;
        }

        .dot {
            width: 8px;
            height: 8px;
            background: #fff;
            border-radius: 50%;
            display: inline-block;
            margin-right: 5px;
        }

        .category {
            background: #111;
            border: 1px solid #18181b;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 40px;
        }

        h2 {
            font-size: 1.8rem;
            margin-top: 0;
            opacity: 0.9;
            text-transform: uppercase;
        }

        .subcategory {
            margin-top: 30px;
            padding-left: 20px;
            border-left: 1px solid #222;
        }

        .drop-zone {
            border: 2px dashed #222;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
            color: #444;
            font-size: 14px;
            position: relative;
        }

        .drop-zone:hover,
        .drop-zone.dragover {
            border-color: #fff;
            color: #fff;
            background: rgba(255, 255, 255, 0.02);
        }

        .drop-zone input {
            position: absolute;
            inset: 0;
            opacity: 0;
            cursor: pointer;
        }

        .images-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .image-card {
            background: #18181b;
            border: 1px solid #222;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
            cursor: grab;
            transition: transform 0.2s;
        }

        .image-card:active {
            cursor: grabbing;
            transform: scale(0.98);
        }

        .image-card img {
            width: 100%;
            height: 130px;
            object-fit: contain;
            background: #000;
            padding: 5px;
            pointer-events: none;
        }

        .image-info {
            padding: 12px;
        }

        .image-info input {
            background: transparent;
            border: none;
            border-bottom: 1px solid #333;
            color: #fff;
            width: 100%;
            font-size: 12px;
            padding: 4px 0;
            outline: none;
            transition: border-color 0.3s;
        }

        .image-info input:focus {
            border-color: #fff;
        }

        .image-info div {
            font-size: 10px;
            color: #444;
            margin-top: 5px;
            word-break: break-all;
            opacity: 0.5;
        }

        .delete-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.1);
            font-size: 10px;
            cursor: pointer;
            height: 32px;
            width: 32px;
            border-radius: 50%;
            opacity: 0;
            transition: all 0.3s;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .delete-btn:hover {
            background: #ff4444;
            border-color: #ff4444;
            transform: scale(1.1);
        }

        .image-card:hover .delete-btn {
            opacity: 1;
        }

        .btn {
            background: #fff;
            color: #000;
            border: none;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.3s;
        }

        .btn:hover {
            background: #ccc;
        }

        .btn-logout {
            background: transparent;
            color: #666;
            border: 1px solid #333;
            font-size: 11px;
            margin-left: 10px;
        }

        .btn-logout:hover {
            color: #fff;
            border-color: #fff;
        }

        .status-msg {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #fff;
            color: #000;
            padding: 10px 20px;
            border-radius: 4px;
            display: none;
            z-index: 1000;
            font-weight: bold;
            font-size: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .delete-confirm-overlay {
            position: absolute;
            inset: 0;
            background: rgba(255, 68, 68, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.3s;
            z-index: 20;
            text-align: center;
            padding: 10px;
        }

        .delete-confirm-overlay.active {
            opacity: 1;
            pointer-events: all;
        }

        .delete-confirm-overlay span {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
        }

        .confirm-actions {
            display: flex;
            gap: 10px;
        }

        .btn-mini {
            padding: 5px 10px;
            font-size: 10px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }

        .btn-confirm {
            background: #fff;
            color: #ff4444;
        }

        .btn-cancel {
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
        }
    </style>
</head>

<body>
    <div id="status" class="status-msg">Saved.</div>

    <div class="header">
        <div class="logo-box">
            <h1><span class="dot"></span>SOERFI.COM <span style="font-weight: 100; opacity: 0.4">ADMIN</span></h1>
        </div>
        <div>
            <a href="/" target="_blank" class="btn btn-logout">View Site</a>
            <a href="?logout" class="btn btn-logout">Logout</a>
        </div>
    </div>

    <?php foreach ($data['categories'] as $cat):
        if ($cat['id'] === 'about')
            continue; ?>
        <div class="category">
            <h2><?php echo $cat['label']; ?></h2>
            <?php foreach ($cat['subcategories'] as $sub): ?>
                <div class="subcategory">
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 14px; color: #fff; font-weight: bold;"><?php echo $sub['label']; ?></span>
                        <span
                            style="font-size: 11px; opacity: 0.3; margin-left: 10px;">/images/<?php echo $sub['path']; ?></span>
                    </div>

                    <div class="drop-zone" id="drop-<?php echo $sub['id']; ?>">
                        <form method="POST" enctype="multipart/form-data" action="admin.php">
                            <input type="hidden" name="action" value="upload">
                            <input type="hidden" name="category_id" value="<?php echo $sub['id']; ?>">
                            <input type="hidden" name="path" value="<?php echo $sub['path']; ?>">
                            <input type="file" name="files[]" multiple onchange="this.form.submit()">
                            <span>Drag images or click to upload</span>
                        </form>
                    </div>

                    <div class="images-grid" id="grid-<?php echo $sub['id']; ?>">
                        <?php foreach ($sub['images'] as $img):
                            $file = is_array($img) ? $img['file'] : $img;
                            $name = is_array($img) ? $img['name'] : "";
                            ?>
                            <div class="image-card" data-filename="<?php echo htmlspecialchars($file); ?>">
                                <img src="images/<?php echo $sub['path']; ?>/<?php echo htmlspecialchars($file); ?>">
                                <div class="image-info">
                                    <input type="text" placeholder="Name..." value="<?php echo htmlspecialchars($name); ?>"
                                        onchange="updateImageName('<?php echo $sub['id']; ?>', '<?php echo htmlspecialchars($file); ?>', this.value)">
                                    <div><?php echo htmlspecialchars($file); ?></div>
                                </div>
                                <div class="delete-btn" onclick="toggleDelete(this)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path
                                            d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2M10 11v6M14 11v6" />
                                    </svg>
                                </div>
                                <div class="delete-confirm-overlay">
                                    <span>Delete?</span>
                                    <div class="confirm-actions">
                                        <form method="POST" style="margin: 0;">
                                            <input type="hidden" name="action" value="delete">
                                            <input type="hidden" name="category_id" value="<?php echo $sub['id']; ?>">
                                            <input type="hidden" name="path" value="<?php echo $sub['path']; ?>">
                                            <input type="hidden" name="filename" value="<?php echo htmlspecialchars($file); ?>">
                                            <button type="submit" class="btn-mini btn-confirm">YES</button>
                                        </form>
                                        <button class="btn-mini btn-cancel"
                                            onclick="toggleDelete(this.closest('.image-card').querySelector('.delete-btn'))">NO</button>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endforeach; ?>

    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.14.0/Sortable.min.js"></script>
    <script>
        // Scroll Position Restoration
        document.addEventListener("DOMContentLoaded", function () {
            const scrollPos = localStorage.getItem("adminScrollPos");
            if (scrollPos) {
                window.scrollTo(0, parseInt(scrollPos));
                localStorage.removeItem("adminScrollPos");
            }
        });

        window.addEventListener("beforeunload", function () {
            localStorage.setItem("adminScrollPos", window.scrollY);
        });

        function toggleDelete(btn) {
            const card = btn.closest('.image-card');
            const overlay = card.querySelector('.delete-confirm-overlay');
            overlay.classList.toggle('active');
        }

        function showStatus() {
            const el = document.getElementById('status');
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 1500);
        }

        function updateImageName(catId, file, newName) {
            const formData = new FormData();
            formData.append('action', 'update_name');
            formData.append('category_id', catId);
            formData.append('file', file);
            formData.append('name', newName);
            fetch('admin.php', { method: 'POST', body: formData })
                .then(r => r.json())
                .then(d => { if (d.status === 'success') showStatus(); });
        }

        document.querySelectorAll('.drop-zone').forEach(zone => {
            zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
            zone.addEventListener('dragleave', () => { zone.classList.remove('dragover'); });
            zone.addEventListener('drop', (e) => { zone.classList.remove('dragover'); });
        });

        <?php foreach ($data['categories'] as $cat):
            if (!isset($cat['subcategories']))
                continue;
            foreach ($cat['subcategories'] as $sub): ?>
                new Sortable(document.getElementById('grid-<?php echo $sub['id']; ?>'), {
                    animation: 150,
                    ghostClass: 'ghost',
                    onEnd: function () {
                        const order = Array.from(this.el.querySelectorAll('.image-card')).map(card => card.dataset.filename);
                        const formData = new FormData();
                        formData.append('action', 'sort');
                        formData.append('category_id', '<?php echo $sub['id']; ?>');
                        formData.append('order', order.join(','));
                        fetch('admin.php', { method: 'POST', body: formData })
                            .then(r => r.json())
                            .then(d => { if (d.status === 'success') showStatus(); });
                    }
                });
            <?php endforeach; endforeach; ?>
    </script>
</body>

</html>