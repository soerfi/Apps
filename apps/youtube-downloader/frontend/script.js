document.getElementById('btn').addEventListener('click', async () => {
    const url = document.getElementById('url').value.trim();
    const status = document.getElementById('status');
    if (!url) return status.textContent = 'Bitte URL eingeben';

    status.textContent = 'Lade herunter...';
    try {
        const res = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Fehler');
        }

        const blob = await res.blob();
        const a = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'video.mp4';
        a.click();
        URL.revokeObjectURL(objectUrl);
        status.textContent = '✅ Download gestartet!';
    } catch (e) {
        status.textContent = 'Fehler: ' + e.message;
    }
});