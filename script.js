// --- 1. CONFIGURATION SUPABASE ---
const SUPABASE_URL = 'https://ycssovdpbbjoubqzdqyf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4s5i1tnBW3io9m3Q2ETazg_Y4WvCLPt';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// --- 3. GESTION DES THÈMES ---
function setTheme(themeName) {
    document.body.className = ''; // Reset classes
    if (themeName !== 'dark') document.body.classList.add('theme-' + themeName);
    localStorage.setItem('user-theme', themeName);
}

function toggleThemeFromLogin() {
    const currentTheme = localStorage.getItem('user-theme') || 'dark';
    const newTheme = (currentTheme === 'dark') ? 'white' : 'dark';
    setTheme(newTheme);
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerText = (newTheme === 'dark') ? '☀️' : '🌙';
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
            identifiant: users[0].identifiant, prenom: users[0].nom, classe: users[0].classe, role: 'eleve'
        }));
        window.location.href = 'eleve.html';
    } else {
        notify("Identifiant ou MDP incorrect", "error");
    }
}

function deconnexion() {
    // Petit effet de vibration sur mobile si dispo
    if (navigator.vibrate) navigator.vibrate(50);
    
    localStorage.clear();
    window.location.href = 'index.html';
}

// --- 5. NAVIGATION PRINCIPALE (ÉLÈVE & SURVEILLANT) ---
async function changeTab(el, key) {
    const container = document.getElementById('main-content');
    if (!container) return;

    // UI Active State
    document.querySelectorAll('.nav-item, .nav-mobile-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');

    const user = JSON.parse(localStorage.getItem('eleveConnecte'));
    if (!user) return window.location.href = 'index.html';

    const jourNom = dateSelectionnee.toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase();
    const coursDuJour = CONFIG_DESIGN.edt[jourNom] || [];

    // --- LOGIQUE DES ONGLETS ---
    
    if (key === 'accueil') {
        container.innerHTML = `
            <h1>Bonjour, ${user.prenom} 👋</h1>
            <div class="accueil-layout" style="display: flex; gap: 25px; align-items: start;">
                <div class="glass-card id-card-column" style="flex: 0 0 320px; padding: 40px 30px; text-align: center;">
                    <div style="background: #34c759; color: white; font-size: 0.65rem; font-weight: 800; padding: 5px 15px; border-radius: 20px; display: inline-block; margin-bottom: 15px; letter-spacing: 1px;">● EN LIGNE</div>
                    <h2 style="margin: 0; font-size:1.8rem;">${user.prenom}</h2>
                    <p style="opacity: 0.5; margin: 5px 0 30px 0;">${user.classe || 'Élève'}</p>
                    <div class="qr-wrapper" style="background: white; padding: 15px; border-radius: 22px; display:inline-block;">
                        <div id="qrcode-accueil"></div>
                    </div>
                </div>
                <div class="glass-card edt-preview-column" style="flex: 1; padding: 30px;">
                    <div class="mini-edt-list"></div>
                    <button onclick="changeTab(null, 'edt')" style="width:100%; margin-top:25px; padding:15px; background:var(--accent-theme); color:white; border:none; border-radius:15px; font-weight:800; cursor:pointer;">VOIR L'EDT COMPLET</button>
                </div>
            </div>`;
        updateMiniEdt();
        new QRCode(document.getElementById("qrcode-accueil"), { text: user.identifiant, width: 180, height: 180 });
    }

    else if (key === 'edt') {
        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:30px;"><h1>Emploi du temps</h1><div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.1); padding: 8px 15px; border-radius: 12px;"><button onclick="changerJour(-1, 'edt')" style="background:none; border:none; color:white; cursor:pointer;">❮</button><span style="font-weight:700; text-transform: capitalize; min-width:120px; text-align:center;">${formaterDateAffichee(dateSelectionnee)}</span><button onclick="changerJour(1, 'edt')" style="background:none; border:none; color:white; cursor:pointer;">❯</button></div></div>`;
        if (coursDuJour.length > 0) {
            coursDuJour.forEach(c => {
                html += `<div class="glass-card" style="padding:20px; border-left: 4px solid ${c.color}; margin-bottom:15px;"><div style="display:flex; justify-content:space-between; align-items:center;"><div><b>${c.n}</b><br><small>Salle ${c.s}</small></div><div style="text-align:right"><div style="font-weight:800; font-size:1.1rem;">${c.h}</div><div style="font-size:0.7rem; opacity:0.5;">fin à ${c.fin}</div></div></div></div>`;
            });
        } else {
            html += `<div class="glass-card" style="padding:40px; text-align:center; opacity:0.5;">Aucun cours ce jour-là.</div>`;
        }
        container.innerHTML = html;
    }

    else if (key === 'notes') {
        container.innerHTML = "<h1>Mes Notes</h1><p>Chargement...</p>";
        const { data: mesNotes } = await supabaseClient.from('notes').select('*').eq('eleve_identifiant', user.identifiant);
        if (!mesNotes || mesNotes.length === 0) return container.innerHTML = "<h1>Mes Notes</h1><p>Aucune note enregistrée.</p>";
        
        const stats = calculerMoyennes(mesNotes);
        let html = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h1>Mes Notes</h1><div class="glass-card" style="padding:10px 25px; border:2px solid var(--accent-theme);"><small style="opacity:0.5;">MOYENNE GÉNÉRALE</small><br><span style="font-size:1.8rem; font-weight:800; color:var(--accent-theme);">${stats.generale}</span></div></div>`;
        html += `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:15px; margin-bottom:40px;">${Object.entries(stats.parMatiere).map(([mat, moy]) => `<div class="glass-card" style="padding:15px; text-align:center; border-bottom:3px solid var(--accent-theme);"><div style="font-size:0.7rem; opacity:0.6; text-transform:uppercase;">${mat}</div><div style="font-size:1.2rem; font-weight:700;">${moy}</div></div>`).join('')}</div>`;
        
        mesNotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(n => {
            html += `<div class="glass-card" style="padding:25px; margin-bottom:15px;"><div style="font-size:0.7rem; opacity:0.5;">${n.matiere}</div><div style="font-size:2rem; font-weight:800; margin:10px 0;">${n.valeur}</div><div style="font-size:0.8rem; opacity:0.3;">${n.date}</div></div>`;
        });
        container.innerHTML = html;
    }

    else if (key === 'saisie_note') {
        container.innerHTML = "<h1>📝 Saisir une note</h1><div class='glass-card' style='padding:20px;'>Chargement des élèves...</div>";
        const { data: listEleves } = await supabaseClient.from('eleves').select('*').order('nom');
        let tableRows = (listEleves || []).map(e => `
            <tr style="border-top: 1px solid rgba(255,255,255,0.05);">
                <td style="padding:15px;"><b>${e.nom.toUpperCase()}</b></td>
                <td style="opacity:0.6;">${e.classe}</td>
                <td style="text-align:right;"><button onclick="ouvrirFormNote('${e.identifiant}', '${e.nom}')" style="background:var(--accent-theme); color:white; border:none; padding:8px 15px; border-radius:10px; cursor:pointer; font-weight:600;">SÉLECTIONNER</button></td>
            </tr>`).join('');
        container.innerHTML = `<h1>📝 Saisir une note</h1><div id="form-container-note"><div class="glass-card" style="padding:20px; overflow-x: auto;"><table style="width:100%; text-align:left; border-collapse:collapse;"><thead><tr style="opacity:0.5; font-size:0.7rem;"><th>ÉLÈVE</th><th>CLASSE</th><th style="text-align:right;">ACTION</th></tr></thead><tbody>${tableRows}</tbody></table></div></div>`;
    }

    else if (key === 'gestion') {
        const { data: allEleves } = await supabaseClient.from('eleves').select('*').order('nom');
        let rows = (allEleves || []).map(e => `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);"><td style="padding:15px;"><b>${e.nom}</b></td><td>${e.classe}</td><td>${e.identifiant}</td><td style="text-align:right;"><button onclick="supprimerEleve('${e.identifiant}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;">🗑️</button></td></tr>`).join('');
        container.innerHTML = `<h1>👥 Gestion Élèves</h1><div class="glass-card" style="padding:25px; margin-bottom:30px;"><div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px;"><input type="text" id="new-nom" placeholder="Nom Prénom" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white;"><input type="text" id="new-classe" placeholder="Classe" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white;"><input type="text" id="new-id" placeholder="ID (ex: matheo.p)" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:white;"><button onclick="ajouterEleveDB()" style="background:white; color:black; border:none; border-radius:10px; font-weight:800; cursor:pointer;">AJOUTER</button></div></div><div class="glass-card" style="padding:20px;"><table style="width:100%; text-align:left;"><thead><tr style="opacity:0.5;"><th>NOM</th><th>CLASSE</th><th>ID</th><th style="text-align:right;">ACTION</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
}

// --- 6. GESTION DES NOTES (SURVEILLANT) ---
function ouvrirFormNote(id, nom) {
    document.getElementById('form-container-note').innerHTML = `
        <div class="glass-card" style="padding:40px; max-width:500px; margin: 0 auto; animation: slideUp 0.4s ease;">
            <button onclick="changeTab(null, 'saisie_note')" style="background:none; border:none; color:white; cursor:pointer; margin-bottom:20px; opacity:0.6;">❮ Retour à la liste</button>
            <h2 style="margin-bottom:25px;">Note pour ${nom}</h2>
            <div style="display:flex; flex-direction:column; gap:15px;">
                <input type="hidden" id="n-id" value="${id}">
                <input type="text" id="n-mat" placeholder="Matière (ex: MATHS)" style="padding:15px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white;">
                <input type="text" id="n-val" placeholder="Note (ex: 15/20)" style="padding:15px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white;">
                <button onclick="saveNote()" style="padding:18px; background:var(--accent-theme); color:white; border:none; border-radius:15px; font-weight:800; cursor:pointer; margin-top:10px;">ENREGISTRER LA NOTE</button>
            </div>
        </div>`;
}

async function saveNote() {
    const id = document.getElementById('n-id').value;
    const mat = document.getElementById('n-mat').value.toUpperCase();
    const val = document.getElementById('n-val').value;
    if(!mat || !val) return notify("Champs vides !", "error");

    const { error } = await supabaseClient.from('notes').insert([{ 
        eleve_identifiant: id, 
        matiere: mat, 
        valeur: val, 
        date: new Date().toLocaleDateString('fr-FR') 
    }]);

    if(error) notify("Erreur base de données", "error"); 
    else { notify("Note enregistrée avec succès !"); changeTab(null, 'saisie_note'); }
}

// --- 7. LOGIQUE DU SCANNER (VÉRIFICATION EN DIRECT) ---
async function verifierScan(idScanne) {
    if (isProcessingScan || !idScanne) return;
    isProcessingScan = true;

    const resMsg = document.getElementById('result-message');
    resMsg.innerHTML = "🔍 Vérification : " + idScanne;

    try {
        const { data: eleve, error } = await supabaseClient
            .from('eleves')
            .select('*')
            .eq('identifiant', idScanne.trim())
            .single();

        if (eleve) {
            // ✅ SUCCÈS
            resMsg.innerHTML = `<div style="background:#22c55e; color:white; padding:15px; border-radius:12px; font-weight:800; animation: bounce 0.5s;">✅ ÉLÈVE IDENTIFIÉ : ${eleve.nom}</div>`;
            const countEl = document.getElementById('total-entrees');
            if(countEl) countEl.innerText = parseInt(countEl.innerText) + 1;
            
            const log = document.getElementById('scan-log');
            if(log) {
                const div = document.createElement('div');
                div.className = 'glass-card';
                div.style.cssText = "padding:12px; margin-bottom:10px; border-left:4px solid #22c55e; background:rgba(34, 197, 94, 0.1);";
                div.innerHTML = `<b>${eleve.nom}</b> <small style="float:right; opacity:0.5;">${new Date().toLocaleTimeString()}</small>`;
                log.prepend(div);
            }
        } else {
            // ❌ ÉCHEC
            resMsg.innerHTML = `<div style="background:#ef4444; color:white; padding:15px; border-radius:12px; font-weight:800;">❌ COMPTE INCONNU : ${idScanne}</div>`;
            const alertEl = document.getElementById('total-alertes');
            if(alertEl) alertEl.innerText = parseInt(alertEl.innerText) + 1;
        }
    } catch (e) {
        resMsg.innerHTML = "Erreur technique";
    }

    setTimeout(() => {
        isProcessingScan = false;
        resMsg.innerHTML = "Prêt à scanner...";
    }, 3000);
}

// --- 8. FONCTIONS BASE DE DONNÉES (GESTION) ---
async function ajouterEleveDB() {
    const nom = document.getElementById('new-nom').value.trim();
    const classe = document.getElementById('new-classe').value.trim();
    const id = document.getElementById('new-id').value.trim();
    if (!nom || !classe || !id) return notify("Données manquantes", "error");

    const { error } = await supabaseClient.from('eleves').insert([{ nom, classe, identifiant: id, password: id }]);
    if (error) notify("Erreur lors de l'ajout", "error"); 
    else { notify("Élève ajouté !"); changeTab(null, 'gestion'); }
}

async function supprimerEleve(id) {
    if (confirm("Voulez-vous vraiment supprimer cet élève ?")) {
        await supabaseClient.from('eleves').delete().eq('identifiant', id);
        changeTab(null, 'gestion');
        notify("Élève supprimé");
    }
}

// --- 9. UTILS (DATES, STATS, NOTIFS) ---
function calculerMoyennes(notes) {
    if (!notes || notes.length === 0) return { parMatiere: {}, generale: 0 };
    const matieres = {};
    notes.forEach(n => {
        const parts = n.valeur.split('/');
        const score = parseFloat(parts[0]);
        const bareme = parseFloat(parts[1]) || 20;
        const note20 = (score / bareme) * 20;
        if (!matieres[n.matiere]) matieres[n.matiere] = { total: 0, count: 0 };
        matieres[n.matiere].total += note20;
        matieres[n.matiere].count += 1;
    });
    let sommeMoyennes = 0, nb = 0;
    const detail = {};
    for (let m in matieres) {
        const moy = matieres[m].total / matieres[m].count;
        detail[m] = moy.toFixed(2);
        sommeMoyennes += moy; nb++;
    }
    return { parMatiere: detail, generale: (sommeMoyennes / nb).toFixed(2) };
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
        </div>`).join('') : `<p style="opacity:0.5; padding:20px 0;">Rien de prévu ce jour.</p>`;
}

function notify(msg, type = "success") {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:${type==='error'?'#ef4444':'#34c759'}; color:white; padding:15px 30px; border-radius:15px; z-index:99999; font-weight:800; box-shadow:0 10px 30px rgba(0,0,0,0.3); animation: slideUp 0.3s ease;`;
    t.innerText = msg; document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 500); }, 3000);
}

// Initialisation
window.onload = () => {
    setTheme(localStorage.getItem('user-theme') || 'dark');
    if(window.location.pathname.includes('eleve.html')) changeTab(null, 'accueil');
};