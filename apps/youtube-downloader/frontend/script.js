// frontend/script.js

document.getElementById('btn').addEventListener('click', async () => {
    const urlInput = document.getElementById('url');
    const status = document.getElementById('status');
    const url = urlInput.value.trim();

    // Simple YouTube URL validation
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/i;
    if (!ytRegex.test(url)) {
        status.textContent = 'Bitte eine gültige YouTube‑URL eingeben';
        return;
    }

    status.textContent = 'Lade herunter...';
    // Disable button to prevent duplicate requests
    const btn = document.getElementById('btn');
    btn.disabled = true;
    try {
        const res = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Fehler beim Download');
        }

        const blob = await res.blob();
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        // Extract filename from Content‑Disposition header if present
        const disposition = res.headers.get('content-disposition');
        const filenameMatch = disposition && disposition.match(/filename="?([^";]+)"?/);
        a.download = filenameMatch ? filenameMatch[1] : 'video.mp4';
        a.click();
        URL.revokeObjectURL(objectUrl);
        status.textContent = '✅ Download gestartet!';
    } catch (e) {
        status.textContent = 'Fehler: ' + e.message;
    } finally {
        btn.disabled = false;
    }
});