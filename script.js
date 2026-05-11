// --- 1. CONFIGURATION SUPABASE ---
const SUPABASE_URL = 'https://ycssovdpbbjoubqzdqyf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4s5i1tnBW3io9m3Q2ETazg_Y4WvCLPt';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- QR DYNAMIQUE (rotation toutes les X secondes) ---
const QR_SECRET = 'elytra_shared_secret_2026';
let QR_ROTATE_SECONDS = 10;
const QR_INSTANCES = new Map();

async function sha256Hex(str) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateQrPayload(identifiant, intervalSeconds = QR_ROTATE_SECONDS) {
    const timeslice = Math.floor(Date.now() / (intervalSeconds * 1000));
    const msg = `${identifiant}:${timeslice}`;
    const hash = await sha256Hex(msg + ':' + QR_SECRET);
    return `${identifiant}:${timeslice}:${hash}`;
}

function stopDynamicQr(elOrId) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    const rec = QR_INSTANCES.get(el);
    if (rec) {
        if (rec.intervalId) clearInterval(rec.intervalId);
        if (rec.timeoutId) clearTimeout(rec.timeoutId);
        if (rec.progressId) clearInterval(rec.progressId);
        QR_INSTANCES.delete(el);
        try { el.innerHTML = ''; } catch (e) {}
    }
}

async function startDynamicQr(elOrId, identifiant, intervalSeconds = QR_ROTATE_SECONDS) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    stopDynamicQr(el);
    el.innerHTML = '';
    if (typeof QRCode === 'undefined') throw new Error('QRCode library not available');
    const qr = new QRCode(el, { text: '', width: 180, height: 180 });
    // Attempt an initial payload generation and throw if it fails so caller can fallback
    let initialPayload;
    try {
        initialPayload = await generateQrPayload(identifiant, intervalSeconds);
    } catch (err) {
        // cleanup and rethrow to let caller handle fallback
        try { el.innerHTML = ''; } catch (e) {}
        throw err;
    }

    try { qr.makeCode(initialPayload); } catch (e) { console.warn('qr.makeCode initial failed', e); }

    // align updates to the epoch-based timeslice used by generateQrPayload
    const period = intervalSeconds * 1000;
    const now = Date.now();
    const elapsed = now % period;
    const timeToNext = period - elapsed;

    const rec = { qr };

    const updateOnce = async () => {
        try {
            const payload = await generateQrPayload(identifiant, intervalSeconds);
            qr.makeCode(payload);
        } catch (err) { console.error('startDynamicQr update error', err); }
    };

    // schedule first update exactly at the next timeslice boundary, then repeat every period
    const timeoutId = setTimeout(() => {
        updateOnce();
        const intervalId = setInterval(updateOnce, period);
        rec.intervalId = intervalId;
    }, timeToNext);

    rec.timeoutId = timeoutId;
    QR_INSTANCES.set(el, rec);
    try { startQrProgress(el, intervalSeconds); } catch (e) { console.warn('startQrProgress failed', e); }
    return rec;
}

async function verifyDynamicQrPayload(payload, intervalSeconds = QR_ROTATE_SECONDS, tolerance = 1) {
    if (!payload || typeof payload !== 'string') return null;
    const parts = payload.split(':');
    if (parts.length !== 3) return null;
    const [identifiant, timesliceStr, hash] = parts;
    if (!identifiant || !timesliceStr || !hash) return null;
    const timeslice = parseInt(timesliceStr, 10);
    if (isNaN(timeslice)) return null;
    for (let diff = -tolerance; diff <= tolerance; diff++) {
        const ts = timeslice + diff;
        const expected = await sha256Hex(`${identifiant}:${ts}:${QR_SECRET}`);
        if (expected === hash) {
            const nowSlice = Math.floor(Date.now() / (intervalSeconds * 1000));
            if (Math.abs(nowSlice - timeslice) <= tolerance) return identifiant;
            else return null;
        }
    }
    return null;
}

// Visual progress bar for dynamic QR and interval control handlers
function startQrProgress(el, intervalSeconds) {
    const fill = document.getElementById('qr-progress-fill');
    if (!fill) return;
    const rec = QR_INSTANCES.get(el) || {};
    if (rec.progressId) clearInterval(rec.progressId);
    const period = intervalSeconds * 1000;
    rec.progressId = setInterval(() => {
        const now = Date.now();
        const pos = (now % period) / period;
        fill.style.width = (pos * 100).toFixed(2) + '%';
    }, 200);
    // immediate update
    const now = Date.now();
    const pos0 = (now % period) / period;
    fill.style.width = (pos0 * 100).toFixed(2) + '%';
    QR_INSTANCES.set(el, rec);
}

function onQrIntervalChange(e) {
    const v = parseInt(e.target.value, 10) || QR_ROTATE_SECONDS;
    const span = document.getElementById('qr-interval-value');
    if (span) span.innerText = v + 's';
    updateQrInterval(v);
}

function updateQrInterval(newInterval) {
    QR_ROTATE_SECONDS = newInterval;
    const user = JSON.parse(localStorage.getItem('eleveConnecte'));
    const qEl = document.getElementById('qrcode-accueil');
    const qNote = document.getElementById('qrcode-note');
    if (qNote) qNote.innerText = 'Mise à jour intervalle...';
    if (!qEl || !user) {
        if (qNote) qNote.innerText = 'Aucun QR ou utilisateur connecté';
        return;
    }
    stopDynamicQr(qEl);
    if (typeof startDynamicQr === 'function') {
        startDynamicQr(qEl, user.identifiant, newInterval).then(() => {
            if (qNote) qNote.innerText = '';
        }).catch(err => {
            console.warn('Failed restarting dynamic QR', err);
            if (qNote) qNote.innerText = 'QR dynamique indisponible — affichage statique';
            try {
                if (typeof QRCode !== 'undefined') new QRCode(qEl, { text: user.identifiant, width: 180, height: 180 });
                else qEl.innerText = user.identifiant;
            } catch (e) {
                qEl.innerText = user.identifiant;
            }
        });
    } else {
        if (qNote) qNote.innerText = 'startDynamicQr manquant';
    }
}

// --- 2. DONNÉES DE L'EMPLOI DU TEMPS ---
const CONFIG_DESIGN = {
    edt: {
        "lundi": [
            { h: '08:15', fin: '09:10', n: 'HIST.GEO.EN.MOR.CIV.', s: 'E14', color: '#fde047' },
            { h: '09:10', fin: '10:05', n: 'MATHÉMATIQUES', s: 'E14', color: '#e5e7eb' },
            { h: '11:15', fin: '12:10', n: 'ANGLAIS LV1', s: 'E14', color: '#6366f1' },
            { h: '13:05', fin: '16:00', n: 'GÉNIE INDUSTRIEL', s: 'E14', color: '#86efac' },
            { h: '16:00', fin: '16:55', n: 'PRÉVENT.-SANTE-ENV.', s: 'E14', color: '#fca5a5' }
        ],
        "mardi": [
            { h: '08:15', fin: '09:10', n: 'MATHÉMATIQUES', s: 'E14', color: '#e5e7eb' },
            { h: '10:20', fin: '12:10', n: 'ARTS APPL. CULT. ARTIS', s: 'B5', color: '#fda4af' },
            { h: '13:05', fin: '14:00', n: 'ENS. TECHNOL. PROFESS.', s: 'E14', color: '#86efac' },
            { h: '14:00', fin: '14:55', n: 'STI CO-INTERVENTION MATH', s: 'E14', color: '#86efac' },
            { h: '14:55', fin: '17:50', n: 'GÉNIE INDUSTRIEL', s: 'E13', color: '#86efac' }
        ],
        "mercredi": [
            { h: '09:10', fin: '11:15', n: 'PHYSIQUE-CHIMIE', s: 'B12', color: '#e5e7eb' },
            { h: '11:15', fin: '12:10', n: 'ANGLAIS LV1', s: 'E14', color: '#6366f1' }
        ],
        "jeudi": [
            { h: '08:15', fin: '09:10', n: 'HIST.GEO.EN.MOR.CIV.', s: 'E14', color: '#fde047' },
            { h: '09:10', fin: '10:20', n: 'FRANÇAIS', s: 'E14', color: '#fde047' },
            { h: '10:20', fin: '11:15', n: 'SOUTIEN AU PARCOURS', s: 'E14', color: '#fca5a5' },
            { h: '11:15', fin: '12:10', n: 'FRANÇAIS', s: 'E14', color: '#fde047' },
            { h: '14:00', fin: '16:00', n: 'ED. PHYSIQUE & SPORT', s: 'Gymnase', color: '#99f6e4' },
            { h: '16:00', fin: '16:55', n: 'ENS. TECHNOL. PROFESS.', s: 'E14', color: '#86efac' }
        ],
        "vendredi": [
            { h: '08:15', fin: '10:20', n: 'GÉNIE INDUSTRIEL', s: 'E12', color: '#86efac' },
            { h: '10:20', fin: '12:10', n: 'GÉNIE INDUSTRIEL', s: 'E16', color: '#86efac' },
            { h: '13:05', fin: '14:00', n: 'ECONOMIE-GESTION', s: 'E14', color: '#fda4af' }
        ],
        "samedi": [],
        "dimanche": []
    }
};

let dateSelectionnee = new Date();
let isProcessingScan = false;
let codeGenere = null; // Stockage temporaire du code Email


// --- 3. GESTION DES THÈMES ---
function setTheme(themeName) {
    document.body.className = ''; 
    if (themeName !== 'dark') document.body.classList.add('theme-' + themeName);
    localStorage.setItem('user-theme', themeName);
}

// --- 4. AUTHENTIFICATION ---
async function connexion() {
    const userIn = document.getElementById('username').value.trim();
    const passIn = document.getElementById('password').value.trim();
    
    if (!userIn || !passIn) return notify("Remplis tous les champs", "error");

    if (userIn === "surveillant" && passIn === "surveillant") {
        localStorage.setItem('eleveConnecte', JSON.stringify({ prenom: "Staff", role: "surveillant" }));
        window.location.href = 'surveillant.html';
        return;
    }

    const { data: users, error } = await supabaseClient.from('eleves').select('*').eq('identifiant', userIn).eq('password', passIn);
    
    if (users && users.length > 0) {
        localStorage.setItem('eleveConnecte', JSON.stringify({
            identifiant: users[0].identifiant, prenom: users[0].nom, classe: users[0].classe, role: 'eleve', email: users[0].email
        }));
        window.location.href = 'eleve.html';
    } else {
        notify("Identifiant ou MDP incorrect", "error");
    }
}

function deconnexion() {
    if (navigator.vibrate) navigator.vibrate(50);
    localStorage.clear();
    window.location.href = 'index.html';
}

// --- 5. NAVIGATION PRINCIPALE ---
async function changeTab(el, key) {
    const container = document.getElementById('main-content');
    if (!container) return;

    document.querySelectorAll('.nav-item, .nav-mobile-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    const user = JSON.parse(localStorage.getItem('eleveConnecte'));
    if (!user) return window.location.href = 'index.html';

    const sidebarName = document.getElementById('display-user-name');
    const sidebarClass = document.getElementById('display-user-class');
    if(sidebarName) sidebarName.innerText = user.prenom;
    if(sidebarClass) sidebarClass.innerText = user.classe || "Élève";

    const jourNom = dateSelectionnee.toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase();
    const coursDuJour = CONFIG_DESIGN.edt[jourNom] || [];

    if (key === 'accueil') {
        container.innerHTML = `
            <h1>Bonjour, ${user.prenom} 👋</h1>
            <div class="accueil-layout" style="display: flex; gap: 25px; align-items: start; flex-wrap:wrap;">
                <div class="glass-card" style="flex: 1; min-width:300px; padding: 40px 30px; text-align: center;">
                    <div style="background: #34c759; color: white; font-size: 0.65rem; font-weight: 800; padding: 5px 15px; border-radius: 20px; display: inline-block; margin-bottom: 15px; letter-spacing: 1px;">● EN LIGNE</div>
                    <h2 style="margin: 0; font-size:1.8rem;">${user.prenom}</h2>
                    <p style="opacity: 0.5; margin: 5px 0 30px 0;">${user.classe || 'Élève'}</p>
                    <div class="qr-wrapper" style="background: white; padding: 15px; border-radius: 22px; display:inline-block; text-align:center;">
                        <div id="qrcode-accueil"></div>
                        <div id="qrcode-note" style="margin-top:8px; font-size:0.85rem; color:#333; opacity:0.8;"></div>
                        <div id="qr-progress" style="margin-top:10px; height:8px; width:180px; background:#eee; border-radius:4px; overflow:hidden; display:block; margin-left:auto; margin-right:auto;">
                            <div id="qr-progress-fill" style="width:0%; height:100%; background:linear-gradient(90deg,#34c759,#10b981); transition:width 0.2s linear;"></div>
                        </div>
                    </div>
                </div>
                <div class="glass-card" style="flex: 1.5; min-width:300px; padding: 30px;">
                    <h3 style="margin-top:0">Aujourd'hui</h3>
                    <div class="mini-edt-list"></div>
                    <button onclick="changeTab(null, 'edt')" style="width:100%; margin-top:25px; padding:15px; background:var(--accent-theme); color:white; border:none; border-radius:15px; font-weight:800; cursor:pointer;">VOIR L'EDT COMPLET</button>
                </div>
            </div>`;
        updateMiniEdt();
        // start dynamic QR (rotation every QR_ROTATE_SECONDS) with robust fallback and user note
        const qEl = document.getElementById('qrcode-accueil');
        const qNoteEl = document.getElementById('qrcode-note');
        stopDynamicQr(qEl);
        if (qNoteEl) qNoteEl.innerText = 'Chargement du QR dynamique...';
        try {
            if (typeof startDynamicQr === 'function') {
                await startDynamicQr(qEl, user.identifiant, QR_ROTATE_SECONDS);
                if (qNoteEl) qNoteEl.innerText = '';
            } else {
                throw new Error('startDynamicQr not defined');
            }
        } catch (err) {
            console.warn('Dynamic QR failed, falling back to static', err);
            try {
                if (typeof QRCode !== 'undefined') {
                    new QRCode(qEl, { text: user.identifiant, width: 180, height: 180 });
                } else {
                    qEl.innerText = user.identifiant;
                }
                if (qNoteEl) qNoteEl.innerText = 'QR dynamique indisponible — affichage statique';
            } catch (e) {
                console.error('Static QR creation failed', e);
                qEl.innerText = user.identifiant;
                if (qNoteEl) qNoteEl.innerText = 'QR dynamique indisponible — affichage texte';
            }
        }
    }

    else if (key === 'edt') {
        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px; flex-wrap:wrap; gap:10px;"><h1>Emploi du temps</h1><div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.1); padding: 8px 15px; border-radius: 12px;"><button onclick="changerJour(-1, 'edt')" style="background:none; border:none; color:white; cursor:pointer;">❮</button><span style="font-weight:700; text-transform: capitalize; min-width:120px; text-align:center;">${formaterDateAffichee(dateSelectionnee)}</span><button onclick="changerJour(1, 'edt')" style="background:none; border:none; color:white; cursor:pointer;">❯</button></div></div>`;
        if (coursDuJour.length > 0) {
            coursDuJour.forEach(c => {
                html += `<div class="glass-card" style="padding:20px; border-left: 4px solid ${c.color}; margin-bottom:15px;"><div style="display:flex; justify-content:space-between; align-items:center;"><div><b>${c.n}</b><br><small>Salle ${c.s}</small></div><div style="text-align:right"><div style="font-weight:800; font-size:1.1rem;">${c.h}</div><div style="font-size:0.7rem; opacity:0.5;">fin à ${c.fin}</div></div></div></div>`;
            });
        } else { html += `<div class="glass-card" style="padding:40px; text-align:center; opacity:0.5;">Aucun cours ce jour-là.</div>`; }
        container.innerHTML = html;
    }

    else if (key === 'notes') {
        container.innerHTML = "<h1>Mes Notes</h1><p>Chargement...</p>";
        const { data: mesNotes } = await supabaseClient.from('notes').select('*').eq('eleve_identifiant', user.identifiant);
        if (!mesNotes || mesNotes.length === 0) return container.innerHTML = "<h1>Mes Notes</h1><p>Aucune note enregistrée.</p>";
        const stats = calculerMoyennes(mesNotes);
        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap;"><h1>Mes Notes</h1><div class="glass-card" style="padding:10px 25px; border:2px solid var(--accent-theme);"><small style="opacity:0.5;">MOYENNE GÉNÉRALE</small><br><span style="font-size:1.8rem; font-weight:800; color:var(--accent-theme);">${stats.generale}</span></div></div>`;
        html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:15px; margin-bottom:40px;">${Object.entries(stats.parMatiere).map(([mat, moy]) => `<div class="glass-card" style="padding:15px; text-align:center; border-bottom:3px solid var(--accent-theme);"><div style="font-size:0.7rem; opacity:0.6; text-transform:uppercase;">${mat}</div><div style="font-size:1.2rem; font-weight:700;">${moy}</div></div>`).join('')}</div>`;
        mesNotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(n => {
            html += `<div class="glass-card" style="padding:25px; margin-bottom:15px;"><div style="font-size:0.7rem; opacity:0.5;">${n.matiere}</div><div style="font-size:2rem; font-weight:800; margin:10px 0;">${n.valeur}</div><div style="font-size:0.8rem; opacity:0.3;">${n.date}</div></div>`;
        });
        container.innerHTML = html;
    }

    else if (key === 'settings') {
        container.innerHTML = `
            <h1>⚙️ Réglages</h1>
            <div style="display: flex; flex-direction: column; gap: 25px; animation: fadeIn 0.4s ease;">
                <div class="glass-card" style="padding: 25px;">
                    <h3>Apparence</h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                        <div onclick="setTheme('dark')" class="glass-card" style="padding:15px; text-align:center; cursor:pointer; background:#05070a; border:1px solid rgba(255,255,255,0.1);">Sombre</div>
                        <div onclick="setTheme('white')" class="glass-card" style="padding:15px; text-align:center; cursor:pointer; background:#f0f2f5; color:black;">Clair</div>
                        <div onclick="setTheme('purple')" class="glass-card" style="padding:15px; text-align:center; cursor:pointer; background:#1e0a3c; color:white;">Violet</div>
                        <div onclick="setTheme('ocean')" class="glass-card" style="padding:15px; text-align:center; cursor:pointer; background:#001219; color:#94d2bd;">Océan</div>
                    </div>
                </div>

                <div class="glass-card" style="padding: 25px;"> 
                    <h3 style="margin-top:0">Sécurité du compte</h3>
                    <div id="form-secu" style="display: flex; flex-direction: column; gap: 10px; max-width: 400px;">
                        <input type="password" id="old-pass" placeholder="Ancien mot de passe" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white;">
                        <input type="password" id="new-pass" placeholder="Nouveau mot de passe" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white;">
                        <button onclick="preparerChangementMdp()" style="padding:12px; border-radius:10px; border:none; background:var(--accent-theme); color:white; font-weight:800; cursor:pointer;">CHANGRE DE MOT DE PASSE</button>
                    </div>
                    <div id="zone-verif" style="display:none; margin-top:20px; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                        <input type="text" id="input-code-mail" placeholder="CODE À 4 CHIFFRES" style="padding:15px; border-radius:12px; width:100%; border:2px solid var(--accent-theme); background:rgba(168, 85, 247, 0.1); color:white; text-align:center; font-size:1.5rem; font-weight:800; letter-spacing:8px;">
                        <button onclick="validerNouveauMdp()" style="width:100%; margin-top:10px; padding:15px; border-radius:10px; border:none; background:#22c55e; color:white; font-weight:800; cursor:pointer;">VALIDER LE CHANGEMENT</button>
                    </div>
                </div>

                <button onclick="deconnexion()" class="logout-btn" style="max-width: 200px;">DÉCONNEXION</button>
            </div>`;
    }
}

// --- 6. LOGIQUE SÉCURITÉ (CHANGEMENT MDP) ---

async function preparerChangementMdp() {
    const user = JSON.parse(localStorage.getItem('eleveConnecte'));
    const oldP = document.getElementById('old-pass').value;
    const newP = document.getElementById('new-pass').value;

    if(!oldP || !newP) return notify("Champs vides !", "error");

    const { data: eleve } = await supabaseClient.from('eleves').select('password, email').eq('identifiant', user.identifiant).single();

    if (eleve.password !== oldP) return notify("Ancien mot de passe incorrect", "error");
    if (!eleve.email) return notify("Aucun email configuré sur ce compte", "error");

    codeGenere = Math.floor(1000 + Math.random() * 9000);

    // --- ICI TU REMPLIS TES CLÉS EMAILJS ---
    const serviceID = "TON_SERVICE_ID"; 
    const templateID = "TON_TEMPLATE_ID";
    const publicKey = "TON_PUBLIC_KEY";

    emailjs.send(serviceID, templateID, { to_email: eleve.email, user_name: user.prenom, code: codeGenere }, publicKey)
    .then(() => {
        notify("📧 Code envoyé à " + eleve.email);
        document.getElementById('form-secu').style.opacity = "0.3";
        document.getElementById('zone-verif').style.display = "block";
    }, (err) => { notify("Erreur EmailJS", "error"); });
}

async function validerNouveauMdp() {
    const codeSaisi = document.getElementById('input-code-mail').value;
    const newP = document.getElementById('new-pass').value;
    const user = JSON.parse(localStorage.getItem('eleveConnecte'));

    if (codeSaisi != codeGenere) return notify("Code incorrect", "error");

    const { error } = await supabaseClient.from('eleves').update({ password: newP }).eq('identifiant', user.identifiant);

    if (error) notify("Erreur DB", "error");
    else { notify("✅ Mot de passe changé !"); setTimeout(() => location.reload(), 1500); }
}

// --- 7. LOGIQUE SURVEILLANT (SCAN & NOTES) ---

async function verifierScan(idScanne) {
    if (isProcessingScan || !idScanne) return;
    isProcessingScan = true;
    const resMsg = document.getElementById('result-message');
    resMsg.innerHTML = "🔍 Vérification...";

    const { data: eleve } = await supabaseClient.from('eleves').select('*').eq('identifiant', idScanne.trim()).single();

    if (eleve) {
        resMsg.innerHTML = `<div style="background:#22c55e; color:white; padding:15px; border-radius:12px; font-weight:800;">✅ IDENTIFIÉ : ${eleve.nom}</div>`;
        document.getElementById('total-entrees').innerText++;
        const log = document.getElementById('scan-log');
        const div = document.createElement('div');
        div.className = 'glass-card';
        div.style.cssText = "padding:10px; margin-bottom:8px; border-left:4px solid #22c55e;";
        div.innerHTML = `<b>${eleve.nom}</b> <small style="float:right;">${new Date().toLocaleTimeString()}</small>`;
        log.prepend(div);
    } else {
        resMsg.innerHTML = `<div style="background:#ef4444; color:white; padding:15px; border-radius:12px; font-weight:800;">❌ INCONNU</div>`;
        document.getElementById('total-alertes').innerText++;
    }

    setTimeout(() => { isProcessingScan = false; resMsg.innerHTML = "Prêt à scanner..."; }, 3000);
}

function ouvrirFormNote(id, nom) {
    document.getElementById('form-container-note').innerHTML = `
        <div class="glass-card" style="padding:30px; max-width:400px; margin:0 auto;">
            <button onclick="changeTab(null, 'saisie_note')" style="background:none; border:none; color:white; cursor:pointer; opacity:0.5; margin-bottom:10px;">❮ Retour</button>
            <h3>Note pour ${nom}</h3>
            <input type="hidden" id="n-id" value="${id}">
            <input type="text" id="n-mat" placeholder="Matière" style="padding:12px; width:100%; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; margin-bottom:10px;">
            <input type="text" id="n-val" placeholder="Note (ex: 18/20)" style="padding:12px; width:100%; border-radius:10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; margin-bottom:10px;">
            <button onclick="saveNote()" style="width:100%; padding:15px; background:var(--accent-theme); border:none; border-radius:12px; color:white; font-weight:800; cursor:pointer;">ENREGISTRER</button>
        </div>`;
}

async function saveNote() {
    const id = document.getElementById('n-id').value;
    const mat = document.getElementById('n-mat').value.toUpperCase();
    const val = document.getElementById('n-val').value;
    if(!mat || !val) return notify("Champs vides !", "error");

    const { error } = await supabaseClient.from('notes').insert([{ eleve_identifiant: id, matiere: mat, valeur: val, date: new Date().toLocaleDateString('fr-FR') }]);
    if(error) notify("Erreur", "error"); 
    else { notify("Note enregistrée !"); changeTab(null, 'saisie_note'); }
}

async function ajouterEleveDB() {
    const nom = document.getElementById('new-nom').value.trim();
    const classe = document.getElementById('new-classe').value.trim();
    const id = document.getElementById('new-id').value.trim();
    const email = document.getElementById('new-email')?.value.trim() || "";
    if (!nom || !classe || !id) return notify("Données manquantes", "error");

    const { error } = await supabaseClient.from('eleves').insert([{ nom, classe, identifiant: id, password: id, email: email }]);
    if (error) notify("Erreur", "error"); 
    else { notify("Élève ajouté !"); changeTab(null, 'gestion'); }
}

async function supprimerEleve(id) {
    if (confirm("Supprimer cet élève ?")) {
        await supabaseClient.from('eleves').delete().eq('identifiant', id);
        changeTab(null, 'gestion');
        notify("Élève supprimé");
    }
}

// --- 8. UTILS ---

function calculerMoyennes(notes) {
    if (!notes || notes.length === 0) return { parMatiere: {}, generale: 0 };
    const matieres = {};
    notes.forEach(n => {
        const parts = n.valeur.split('/');
        const note20 = (parseFloat(parts[0]) / (parseFloat(parts[1]) || 20)) * 20;
        if (!matieres[n.matiere]) matieres[n.matiere] = { total: 0, count: 0 };
        matieres[n.matiere].total += note20;
        matieres[n.matiere].count++;
    });
    let somme = 0, nb = 0, detail = {};
    for (let m in matieres) {
        let m_moy = matieres[m].total / matieres[m].count;
        detail[m] = m_moy.toFixed(2);
        somme += m_moy; nb++;
    }
    return { parMatiere: detail, generale: (somme / nb).toFixed(2) };
}

function formaterDateAffichee(date) { return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' }); }
function changerJour(delta, type) { dateSelectionnee.setDate(dateSelectionnee.getDate() + delta); if (type === 'accueil') updateMiniEdt(); else changeTab(null, type); }

function updateMiniEdt() {
    const jour = dateSelectionnee.toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase();
    const cours = CONFIG_DESIGN.edt[jour] || [];
    const ml = document.querySelector('.mini-edt-list');
    if (ml) ml.innerHTML = cours.length > 0 ? cours.map(c => `
        <div style="display:flex; justify-content:space-between; padding: 12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div><div style="font-weight:700; color:${c.color};">${c.n}</div><small style="opacity:0.6;">Salle ${c.s}</small></div>
            <div style="font-weight:700;">${c.h}</div>
        </div>`).join('') : `<p style="opacity:0.5; padding:20px 0;">Repos.</p>`;
}

function notify(msg, type = "success") {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:${type==='error'?'#ef4444':'#34c759'}; color:white; padding:15px 30px; border-radius:15px; z-index:99999; font-weight:800; box-shadow:0 10px 30px rgba(0,0,0,0.3); animation: slideUp 0.3s ease; transition:0.5s;`;
    t.innerText = msg; document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 3000);
}

window.onload = () => {
    setTheme(localStorage.getItem('user-theme') || 'dark');
    if(window.location.pathname.includes('eleve.html')) changeTab(null, 'accueil');
    if(window.location.pathname.includes('surveillant.html')) changeTab(null, 'scanner');
};