/**
 * The 12-language text layer.
 *
 * Order of every array is LANGUAGES:
 *   ja, en, zh-Hans, zh-Hant, ko, es, fr, de, pt, it, hi, id
 *
 * Japanese is the source language; the rest are translations of the same line.
 * `tests/unit/i18n.test.js` checks every key has twelve non-empty entries, that
 * no Japanese kana leaks into the other eleven, and that the stamp / HUD keys
 * the online layer sends exist.
 */
import { LANGUAGES, STORAGE } from './config.js';

export const LANG_ORDER = LANGUAGES;

const T = {
  /* ---------------- menu ---------------- */
  'menu.tagline': [
    '人狼を見抜け。全員凍らせるか、脱出しろ。',
    'Find the wolf. Freeze them all, or escape.',
    '找出人狼。冻结所有人，或者逃出去。',
    '找出人狼。凍結所有人，或者逃出去。',
    '늑대를 찾아라. 모두 얼리거나, 탈출하라.',
    'Encuentra al lobo. Congélalos a todos o escapa.',
    'Démasquez le loup. Congelez-les tous, ou échappez-vous.',
    'Finde den Wolf. Friere alle ein – oder entkomme.',
    'Encontre o lobo. Congele todos ou escape.',
    'Scopri il lupo. Congela tutti o scappa.',
    'भेड़िये को पहचानो। सबको जमाओ, या भाग निकलो।',
    'Temukan serigala. Bekukan semua, atau kabur.',
  ],
  'menu.start': [
    'ゲームスタート',
    'START GAME',
    '开始游戏',
    '開始遊戲',
    '게임 시작',
    'EMPEZAR',
    'JOUER',
    'SPIELEN',
    'JOGAR',
    'GIOCA',
    'खेल शुरू करें',
    'MULAI',
  ],
  'menu.how': ['遊び方', 'HOW TO PLAY', '玩法说明', '玩法說明', '게임 방법', 'CÓMO JUGAR', 'COMMENT JOUER', 'ANLEITUNG', 'COMO JOGAR', 'COME GIOCARE', 'कैसे खेलें', 'CARA BERMAIN'],
  'menu.record': ['戦績', 'RECORD', '战绩', '戰績', '전적', 'RÉCORDS', 'STATS', 'REKORD', 'RECORDE', 'RECORD', 'रिकॉर्ड', 'REKOR'],
  'menu.settings': ['設定', 'SETTINGS', '设置', '設定', '설정', 'AJUSTES', 'RÉGLAGES', 'EINSTELLUNGEN', 'AJUSTES', 'IMPOSTAZIONI', 'सेटिंग्स', 'PENGATURAN'],
  'menu.online': ['オンライン', 'ONLINE', '在线对战', '線上對戰', '온라인', 'EN LÍNEA', 'EN LIGNE', 'ONLINE', 'ONLINE', 'ONLINE', 'ऑनलाइन', 'DARING'],
  'menu.pro': ['PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO'],
  'menu.stage': ['ステージ', 'STAGE', '关卡', '關卡', '스테이지', 'ESCENARIO', 'TERRAIN', 'ARENA', 'PALCO', 'ARENA', 'मैदान', 'ARENA'],

  'common.back': ['戻る', 'BACK', '返回', '返回', '뒤로', 'VOLVER', 'RETOUR', 'ZURÜCK', 'VOLTAR', 'INDIETRO', 'वापस', 'KEMBALI'],
  'common.close': ['閉じる', 'CLOSE', '关闭', '關閉', '닫기', 'CERRAR', 'FERMER', 'SCHLIESSEN', 'FECHAR', 'CHIUDI', 'बंद करें', 'TUTUP'],
  'common.on': ['ON', 'ON', '开', '開', 'ON', 'SÍ', 'OUI', 'AN', 'LIG', 'SÌ', 'चालू', 'AKTIF'],
  'common.off': ['OFF', 'OFF', '关', '關', 'OFF', 'NO', 'NON', 'AUS', 'DESL', 'NO', 'बंद', 'MATI'],
  'common.ok': ['OK', 'OK', '好', '好', '확인', 'OK', 'OK', 'OK', 'OK', 'OK', 'ठीक', 'OK'],
  'common.proBadge': ['PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO', 'PRO'],
  'common.locked': ['PROで解放', 'Unlock with PRO', 'PRO解锁', 'PRO解鎖', 'PRO로 해금', 'Desbloquea con PRO', 'Débloquer avec PRO', 'Mit PRO freischalten', 'Desbloqueie com PRO', 'Sblocca con PRO', 'PRO से खोलें', 'Buka dengan PRO'],
  'common.reset': ['リセット', 'RESET', '重置', '重設', '초기화', 'REINICIAR', 'RÉINITIALISER', 'ZURÜCKSETZEN', 'REDEFINIR', 'RIPRISTINA', 'रीसेट', 'ATUR ULANG'],

  /* ---------------- how to play ---------------- */
  'how.title': ['遊び方', 'HOW TO PLAY', '玩法说明', '玩法說明', '게임 방법', 'CÓMO JUGAR', 'COMMENT JOUER', 'ANLEITUNG', 'COMO JOGAR', 'COME GIOCARE', 'कैसे खेलें', 'CARA BERMAIN'],
  'how.p1': [
    '氷の上で遊ぶ人狼ゲーム。見た目は全員同じ。最初の鬼は「マスター鬼」1人だけで、試合中ずっと鬼のまま。',
    'A werewolf game on ice. Everyone looks alike. There is one first wolf — the master wolf — and it stays a wolf all match.',
    '冰上人狼游戏。所有人外表相同。最初的鬼只有「首领鬼」1人，整场都是鬼。',
    '冰上人狼遊戲。所有人外表相同。最初的鬼只有「首領鬼」1人，整場都是鬼。',
    '얼음 위 늑대인간 게임. 모두 똑같이 생겼고, 첫 늑대는 "마스터 늑대" 한 명뿐이며 경기 내내 늑대입니다.',
    'Un juego de hombres lobo sobre hielo. Todos se ven igual. Solo hay un primer lobo —el lobo maestro— y sigue siéndolo toda la partida.',
    'Un jeu de loup-garou sur la glace. Tout le monde se ressemble. Un seul premier loup — le loup maître — et il le reste toute la partie.',
    'Ein Werwolf-Spiel auf Eis. Alle sehen gleich aus. Es gibt nur einen ersten Wolf – den Meisterwolf – und er bleibt es die ganze Partie.',
    'Um jogo de lobisomem no gelo. Todos parecem iguais. Há um único primeiro lobo — o lobo mestre — e ele continua lobo a partida inteira.',
    'Un gioco di lupi mannari sul ghiaccio. Tutti sembrano uguali. C’è un solo primo lupo — il lupo maestro — e resta lupo per tutta la partita.',
    'बर्फ पर वेयरवुल्फ खेल। सब एक जैसे दिखते हैं। पहला भेड़िया एक ही है — मास्टर भेड़िया — और पूरे मैच भेड़िया रहता है।',
    'Game werewolf di atas es. Semua tampak sama. Hanya ada satu serigala pertama — serigala master — dan ia tetap serigala sepanjang pertandingan.',
  ],
  'how.p2': [
    'マスター鬼：試合中ずっと鬼の姿と能力のまま。人間に触れるだけで凍らせる（ボタン操作は不要）。',
    'Master wolf: a wolf for the whole match, in wolf body and ability. Touching a human freezes them — no button needed.',
    '首领鬼：整场都是鬼的形态和能力。只要碰到人类就会冻结（无需按键）。',
    '首領鬼：整場都是鬼的形態和能力。只要碰到人類就會凍結（無需按鍵）。',
    '마스터 늑대: 경기 내내 늑대 모습과 능력 그대로. 인간을 스치기만 해도 얼립니다(버튼 불필요).',
    'Lobo maestro: lobo toda la partida, con cuerpo y poder de lobo. Tocar a un humano lo congela, sin botón.',
    'Loup maître : loup toute la partie, corps et pouvoir compris. Toucher un humain le gèle, sans bouton.',
    'Meisterwolf: die ganze Partie Wolf, mit Körper und Kraft. Eine Berührung friert Menschen ein – ohne Taste.',
    'Lobo mestre: lobo a partida inteira, com corpo e poder de lobo. Tocar um humano o congela, sem botão.',
    'Lupo maestro: lupo per tutta la partita, corpo e potere compresi. Toccare un umano lo congela, senza pulsante.',
    'मास्टर भेड़िया: पूरे मैच भेड़िये के रूप और शक्ति में। इंसान को छूते ही जम जाता है, कोई बटन नहीं।',
    'Serigala master: serigala sepanjang pertandingan, lengkap dengan wujud dan kemampuannya. Menyentuh manusia langsung membekukannya, tanpa tombol.',
  ],
  'how.p3': [
    '人狼鬼（2人目の鬼）：人間⇔鬼に変身できる。人間の姿なら凍らせないし、救助対象にもならない。指名はできない。',
    'Werewolf (the second wolf): switches between human and wolf form. In human form it freezes nobody and is nobody’s rescue target. It cannot name bait ice.',
    '人狼鬼（第二个鬼）：可以在人和鬼之间变身。人形时不会冻结别人，也不会成为救助对象。不能指名。',
    '人狼鬼（第二個鬼）：可以在人和鬼之間變身。人形時不會凍結別人，也不會成為救助對象。不能指名。',
    '늑대인간(두 번째 늑대): 인간과 늑대 형태를 오갈 수 있습니다. 인간 형태에서는 얼리지도, 구출 대상도 아니며 지목도 못 합니다.',
    'Hombre lobo (el segundo lobo): cambia entre forma humana y de lobo. En forma humana no congela a nadie, no es objetivo de rescate y no puede marcar hielo.',
    'Loup-garou (le deuxième loup) : alterne forme humaine et de loup. En humain, il ne gèle personne, n’est pas sauvé et ne peut pas marquer de glace.',
    'Werwolf (der zweite Wolf): wechselt zwischen Menschen- und Wolfsform. Als Mensch friert er niemanden ein, ist kein Rettungsziel und kann kein Eis markieren.',
    'Lobisomem (o segundo lobo): alterna entre forma humana e de lobo. Humano, não congela ninguém, não pode ser resgatado nem marcar gelo.',
    'Lupo mannaro (il secondo lupo): passa tra forma umana e di lupo. Da umano non congela nessuno, non va salvato e non può marcare il ghiaccio.',
    'वेयरवुल्फ (दूसरा भेड़िया): इंसान और भेड़िया रूप बदल सकता है। इंसान रूप में न किसी को जमाता है, न बचाया जाता है, न चुन सकता है।',
    'Manusia serigala (serigala kedua): bisa berganti bentuk manusia dan serigala. Dalam bentuk manusia tidak membekukan siapa pun, bukan target penyelamatan, dan tidak bisa menandai es.',
  ],
  'how.p4': [
    '人間：凍った仲間を救助し、スイッチでゲートを開けて脱出するか、時間まで生き残る。',
    'Humans: rescue frozen teammates, open a gate with the switches to escape, or survive until time runs out.',
    '人类：救助被冻结的同伴，用开关打开大门逃出，或者坚持到时间结束。',
    '人類：救助被凍結的同伴，用開關打開大門逃出，或堅持到時間結束。',
    '인간: 얼어붙은 동료를 구하고, 스위치로 게이트를 열어 탈출하거나, 시간이 끝날 때까지 버티세요.',
    'Humanos: rescata a los congelados, abre una puerta con los interruptores o sobrevive hasta el final.',
    'Humains : secourez les gelés, ouvrez une porte avec les interrupteurs, ou survivez jusqu’à la fin.',
    'Menschen: rettet Eingefrorene, öffnet mit den Schaltern ein Tor oder überlebt bis zum Zeitende.',
    'Humanos: resgate os congelados, abra um portão com os interruptores ou sobreviva até o fim.',
    'Umani: salvate i congelati, aprite un cancello con gli interruttori o sopravvivete fino alla fine.',
    'इंसान: जमे हुए साथियों को बचाओ, स्विच से गेट खोलकर भागो, या समय खत्म होने तक ज़िंदा रहो।',
    'Manusia: selamatkan rekan yang membeku, buka gerbang dengan sakelar untuk kabur, atau bertahan sampai waktu habis.',
  ],
  'how.p5': [
    '救助は近くで「救助」を約1.2秒長押し。スイッチも約1.6秒長押しで起動。',
    'Hold RESCUE for about 1.2 s beside a teammate. Switches need a 1.6 s hold.',
    '靠近后长按“救助”约1.2秒。开关也需要长按约1.6秒。',
    '靠近後長按「救助」約1.2秒。開關也需要長按約1.6秒。',
    '동료 옆에서 구출을 약 1.2초 길게 누르세요. 스위치도 약 1.6초 누릅니다.',
    'Mantén RESCATE unos 1,2 s junto a un compañero. Los interruptores necesitan 1,6 s.',
    'Maintenez SECOURS environ 1,2 s près d’un coéquipier. Les interrupteurs demandent 1,6 s.',
    'RETTEN etwa 1,2 s neben einem Mitspieler halten. Schalter brauchen 1,6 s.',
    'Segure RESGATE por cerca de 1,2 s ao lado de um colega. Os interruptores pedem 1,6 s.',
    'Tieni SALVA circa 1,2 s accanto a un compagno. Gli interruttori vogliono 1,6 s.',
    'साथी के पास बचाओ को लगभग 1.2 सेकंड दबाए रखें। स्विच भी लगभग 1.6 सेकंड।',
    'Tahan SELAMATKAN sekitar 1,2 detik di dekat rekan. Sakelar butuh 1,6 detik.',
  ],
  'how.p6': [
    '正解スイッチを全部起動すると、3つのゲートのうち1つが開く。生きている人間が触れれば人間の勝利。',
    'Turning on every correct switch opens exactly one of the three gates. A living human touching it wins.',
    '启动全部正确开关后，3个大门中会打开1个。活着的人类碰到即获胜。',
    '啟動全部正確開關後，3個大門中會打開1個。活著的人類碰到即獲勝。',
    '정답 스위치를 모두 켜면 세 게이트 중 하나가 열립니다. 살아 있는 인간이 닿으면 승리.',
    'Todos los interruptores correctos abren una de las tres puertas. Un humano vivo que la toque gana.',
    'Tous les bons interrupteurs ouvrent une des trois portes. Un humain vivant qui la touche gagne.',
    'Alle richtigen Schalter öffnen genau eines der drei Tore. Ein lebender Mensch, der es berührt, gewinnt.',
    'Todos os interruptores corretos abrem um dos três portões. Um humano vivo que o toque vence.',
    'Tutti gli interruttori giusti aprono uno dei tre cancelli. Un umano vivo che lo tocca vince.',
    'सभी सही स्विच चालू करने पर तीन में से एक गेट खुलता है। ज़िंदा इंसान छूए तो जीत।',
    'Semua sakelar benar membuka satu dari tiga gerbang. Manusia hidup yang menyentuhnya menang.',
  ],
  'how.p7': [
    '罠スイッチを押した人間は人狼鬼になる。罠の氷を救助しても、助けた人が人狼鬼になる。',
    'A human who presses the trap switch becomes a werewolf. Rescuing trap ice turns the rescuer into one too.',
    '按下陷阱开关的人类会变成人狼鬼。救助陷阱冰块的人也会变成人狼鬼。',
    '按下陷阱開關的人類會變成人狼鬼。救助陷阱冰塊的人也會變成人狼鬼。',
    '함정 스위치를 누른 인간은 늑대인간이 됩니다. 함정 얼음을 구한 사람도 늑대인간이 됩니다.',
    'Quien pulse el interruptor trampa se vuelve hombre lobo. Rescatar el hielo trampa también convierte al rescatador.',
    'Qui presse l’interrupteur piège devient loup-garou. Secourir la glace piégée transforme aussi le sauveteur.',
    'Wer den Fallenschalter drückt, wird Werwolf. Wer Falleneis rettet, wird ebenfalls Werwolf.',
    'Quem aperta o interruptor-armadilha vira lobisomem. Resgatar o gelo-armadilha também transforma o resgatador.',
    'Chi preme l’interruttore trappola diventa lupo mannaro. Salvare il ghiaccio trappola trasforma chi salva.',
    'जाल स्विच दबाने वाला इंसान वेयरवुल्फ बन जाता है। जाल की बर्फ बचाने वाला भी वेयरवुल्फ बनता है।',
    'Manusia yang menekan sakelar jebakan menjadi manusia serigala. Menyelamatkan es jebakan juga mengubah penyelamatnya.',
  ],
  'how.p8': [
    '鬼は最大3人。3人目は罠（罠スイッチ／罠の氷の救助）でしか生まれない。2人鬼で始まる試合は罠なし。10人まで、スイッチ3/5/7/10個・正解3/5個。',
    'At most three wolves. The third is born only from a trap (the trap switch or rescuing trap ice). A match that opens with two has no trap. Up to 10 players, 3/5/7/10 switches with 3 or 5 correct.',
    '鬼最多3人。第三个鬼只能由陷阱产生（陷阱开关／救助陷阱冰块）。双鬼开局的比赛没有陷阱。最多10人，开关3/5/7/10个、正确3/5个。',
    '鬼最多3人。第三個鬼只能由陷阱產生（陷阱開關／救助陷阱冰塊）。雙鬼開局的比賽沒有陷阱。最多10人，開關3/5/7/10個、正確3/5個。',
    '늑대는 최대 3명. 세 번째 늑대는 함정(함정 스위치/함정 얼음 구출)으로만 생깁니다. 두 명으로 시작하면 함정이 없습니다. 최대 10명, 스위치 3/5/7/10개·정답 3/5개.',
    'Como máximo tres lobos. El tercero solo nace de una trampa (interruptor trampa o rescatar hielo trampa). Con dos al empezar no hay trampa. Hasta 10 jugadores, 3/5/7/10 interruptores y 3 o 5 correctos.',
    'Trois loups au maximum. Le troisième ne naît que d’un piège (interrupteur piège ou glace piégée secourue). À deux au départ, pas de piège. Jusqu’à 10 joueurs, 3/5/7/10 interrupteurs, 3 ou 5 corrects.',
    'Höchstens drei Wölfe. Der dritte entsteht nur durch eine Falle (Fallenschalter oder Falleneis retten). Startet eine Partie mit zweien, gibt es keine Falle. Bis 10 Spieler, 3/5/7/10 Schalter, 3 oder 5 richtig.',
    'No máximo três lobos. O terceiro só nasce de uma armadilha (interruptor-armadilha ou resgatar gelo-armadilha). Com dois no início não há armadilha. Até 10 jogadores, 3/5/7/10 interruptores e 3 ou 5 corretos.',
    'Al massimo tre lupi. Il terzo nasce solo da una trappola (interruttore trappola o ghiaccio trappola salvato). Con due all’inizio niente trappola. Fino a 10 giocatori, 3/5/7/10 interruttori e 3 o 5 giusti.',
    'अधिकतम तीन भेड़िये। तीसरा सिर्फ़ जाल से जन्म लेता है (जाल स्विच या जाल की बर्फ बचाना)। दो से शुरू मैच में जाल नहीं। 10 खिलाड़ी तक, स्विच 3/5/7/10 और सही 3/5।',
    'Paling banyak tiga serigala. Yang ketiga hanya lahir dari jebakan (sakelar jebakan atau menyelamatkan es jebakan). Mulai dengan dua berarti tanpa jebakan. Hingga 10 pemain, sakelar 3/5/7/10 dengan 3 atau 5 benar.',
  ],
  'how.p9': [
    '最初の鬼＝マスター鬼だけが、凍らせた人間を1人だけ「人狼鬼の罠氷」に指名できる（1試合1回）。指名された氷を救助すると、助けた人が人狼鬼になる。',
    'Only the first wolf — the master wolf — may name one frozen human as trap ice (once per match). Whoever rescues that ice becomes a werewolf.',
    '只有最初的鬼＝首领鬼，能把1名被冻结的人类指定为「人狼鬼的陷阱冰」（每场1次）。救助这块冰的人会变成人狼鬼。',
    '只有最初的鬼＝首領鬼，能把1名被凍結的人類指定為「人狼鬼的陷阱冰」（每場1次）。救助這塊冰的人會變成人狼鬼。',
    '첫 늑대=마스터 늑대만 얼어붙은 인간 한 명을 "늑대인간의 함정 얼음"으로 지목할 수 있습니다(경기당 1회). 그 얼음을 구한 사람이 늑대인간이 됩니다.',
    'Solo el primer lobo —el lobo maestro— puede marcar un humano congelado como hielo trampa (una vez por partida). Quien rescate ese hielo se vuelve hombre lobo.',
    'Seul le premier loup — le loup maître — peut marquer un humain gelé comme glace piégée (une fois par partie). Celui qui secourt cette glace devient loup-garou.',
    'Nur der erste Wolf – der Meisterwolf – darf einen eingefrorenen Menschen als Falleneis markieren (einmal pro Partie). Wer dieses Eis rettet, wird Werwolf.',
    'Só o primeiro lobo — o lobo mestre — pode marcar um humano congelado como gelo-armadilha (uma vez por partida). Quem resgatar esse gelo vira lobisomem.',
    'Solo il primo lupo — il lupo maestro — può marcare un umano congelato come ghiaccio trappola (una volta a partita). Chi salva quel ghiaccio diventa lupo mannaro.',
    'सिर्फ़ पहला भेड़िया — मास्टर भेड़िया — एक जमे इंसान को "वेयरवुल्फ का जाल बर्फ" चुन सकता है (प्रति मैच 1 बार)। वह बर्फ बचाने वाला वेयरवुल्फ बनता है।',
    'Hanya serigala pertama — serigala master — yang boleh menandai satu manusia beku sebagai es jebakan (sekali per pertandingan). Siapa yang menyelamatkan es itu menjadi manusia serigala.',
  ],
  'how.controls': [
    '操作：画面のスティック、または画面どこでもドラッグで移動。ボタンは移動に吸われません。',
    'Controls: use the stick, or drag anywhere on the ice. Buttons never swallow your movement.',
    '操作：使用摇杆，或在画面任意处拖动移动。按钮不会抢走移动操作。',
    '操作：使用搖桿，或在畫面任意處拖動移動。按鈕不會搶走移動操作。',
    '조작: 스틱 또는 화면 아무 곳이나 드래그해 이동. 버튼이 이동을 가로채지 않습니다.',
    'Controles: usa el stick o arrastra en cualquier parte del hielo. Los botones nunca se comen el movimiento.',
    'Commandes : le stick, ou glissez n’importe où sur la glace. Les boutons ne volent jamais le déplacement.',
    'Steuerung: Stick oder irgendwo auf dem Eis ziehen. Buttons schlucken keine Bewegung.',
    'Controles: use o stick ou arraste em qualquer lugar do gelo. Os botões nunca engolem o movimento.',
    'Controlli: usa lo stick o trascina ovunque sul ghiaccio. I pulsanti non rubano mai il movimento.',
    'नियंत्रण: स्टिक या बर्फ पर कहीं भी खींचकर चलें। बटन चलना नहीं रोकते।',
    'Kontrol: pakai stik atau geser di mana saja di atas es. Tombol tidak pernah menelan gerakan.',
  ],

  /* ---------------- settings ---------------- */
  'hud.switchLabel': ['スイッチ', 'SWITCH', '开关', '開關', '스위치', 'INTERRUPTOR', 'INTERRUPTEUR', 'SCHALTER', 'INTERRUPTOR', 'INTERRUTTORE', 'स्विच', 'SAKELAR'],
  /* ---------------- in-world signs (Build 38) ---------------- */
  'sign.switch': ['スイッチ', 'SWITCH', '开关', '開關', '스위치', 'INTERRUPTOR', 'INTERRUPTEUR', 'SCHALTER', 'INTERRUPTOR', 'INTERRUTTORE', 'स्विच', 'SAKELAR'],
  'sign.stairs': ['階段 {f}Fへ', 'STAIRS TO {f}F', '楼梯 往{f}F', '樓梯 往{f}F', '계단 {f}F로', 'ESCALERA A {f}F', 'ESCALIER VERS {f}F', 'TREPPE NACH {f}F', 'ESCADA PARA {f}F', 'SCALE VERSO {f}F', '{f}F की सीढ़ी', 'TANGGA KE {f}F'],
  'sign.warp': ['ワープ', 'WARP', '传送', '傳送', '워프', 'TELEPORTE', 'TÉLÉPORT', 'WARP', 'TELEPORTE', 'TELEPORT', 'वार्प', 'WARP'],
  'sign.hall': ['{f}Fフロア', '{f}F FLOOR', '{f}F 楼层', '{f}F 樓層', '{f}F 층', 'PLANTA {f}F', 'ÉTAGE {f}F', '{f}F EBENE', 'PISO {f}F', 'PIANO {f}F', '{f}F मंज़िल', 'LANTAI {f}F'],
  'action.rescue': ['救助', 'RESCUE', '救助', '救助', '구출', 'RESCATE', 'SECOURS', 'RETTEN', 'RESGATE', 'SALVA', 'बचाओ', 'SELAMATKAN'],
  'action.wolf': ['人狼', 'WOLF', '人狼', '人狼', '늑대', 'LOBO', 'LOUP', 'WOLF', 'LOBO', 'LUPO', 'भेड़िया', 'SERIGALA'],
  'action.transform': ['変身', 'SHIFT', '变身', '變身', '변신', 'CAMBIAR', 'CHANGER', 'WANDELN', 'MUDAR', 'CAMBIA', 'बदलो', 'UBAH'],
  'action.infect': ['指名', 'MARK', '指定', '指定', '지목', 'MARCAR', 'MARQUER', 'MARKIEREN', 'MARCAR', 'SEGNA', 'चुनो', 'TANDAI'],
  'action.exit': ['ゲームメニュー', 'GAME MENU', '游戏菜单', '遊戲選單', '게임 메뉴', 'MENÚ', 'MENU', 'SPIELMENÜ', 'MENU', 'MENU', 'गेम मेन्यू', 'MENU GAME'],
  'action.restart': ['やり直す', 'RESTART', '重新开始', '重新開始', '다시 시작', 'REINICIAR', 'RECOMMENCER', 'NEU STARTEN', 'REINICIAR', 'RIAVVIA', 'फिर से', 'ULANGI'],
  'action.menu': ['メインメニューへ', 'MAIN MENU', '返回主菜单', '返回主選單', '메인 메뉴로', 'AL MENÚ', 'AU MENU', 'ZUM MENÜ', 'AO MENU', 'AL MENU', 'मुख्य मेन्यू', 'MENU UTAMA'],
  'settings.title': ['設定', 'SETTINGS', '设置', '設定', '설정', 'AJUSTES', 'RÉGLAGES', 'EINSTELLUNGEN', 'AJUSTES', 'IMPOSTAZIONI', 'सेटिंग्स', 'PENGATURAN'],
  'settings.role': ['役割', 'Role', '身份', '身份', '역할', 'Papel', 'Rôle', 'Rolle', 'Papel', 'Ruolo', 'भूमिका', 'Peran'],
  'role.random': ['おまかせ', 'Random', '随机', '隨機', '랜덤', 'Aleatorio', 'Aléatoire', 'Zufall', 'Aleatório', 'Casuale', 'रैंडम', 'Acak'],
  'role.wolf': ['人狼で遊ぶ', 'Play as wolf', '扮演人狼', '扮演人狼', '늑대 플레이', 'Jugar de lobo', 'Jouer le loup', 'Als Wolf', 'Jogar de lobo', 'Gioca lupo', 'भेड़िया बनें', 'Main serigala'],
  'role.human': ['人間で逃げる', 'Play as human', '扮演人类', '扮演人類', '인간 플레이', 'Jugar de humano', 'Jouer l’humain', 'Als Mensch', 'Jogar de humano', 'Gioca umano', 'इंसान बनें', 'Main manusia'],
  'settings.duration': ['試合時間', 'Match time', '比赛时间', '比賽時間', '경기 시간', 'Tiempo', 'Durée', 'Spielzeit', 'Tempo', 'Durata', 'मैच समय', 'Waktu'],
  'duration.60': ['1分', '1 min', '1分钟', '1分鐘', '1분', '1 min', '1 min', '1 Min.', '1 min', '1 min', '1 मिनट', '1 mnt'],
  'duration.120': ['2分', '2 min', '2分钟', '2分鐘', '2분', '2 min', '2 min', '2 Min.', '2 min', '2 min', '2 मिनट', '2 mnt'],
  'duration.180': ['3分', '3 min', '3分钟', '3分鐘', '3분', '3 min', '3 min', '3 Min.', '3 min', '3 min', '3 मिनट', '3 mnt'],
  'duration.300': ['5分', '5 min', '5分钟', '5分鐘', '5분', '5 min', '5 min', '5 Min.', '5 min', '5 min', '5 मिनट', '5 mnt'],
  'settings.players': ['プレイ人数', 'Players', '人数', '人數', '인원', 'Jugadores', 'Joueurs', 'Spieler', 'Jogadores', 'Giocatori', 'खिलाड़ी', 'Pemain'],
  'settings.wolves': ['人狼の数', 'Wolves', '人狼数', '人狼數', '늑대 수', 'Lobos', 'Loups', 'Wölfe', 'Lobos', 'Lupi', 'भेड़िये', 'Serigala'],
  'settings.switches': ['スイッチの数', 'Switches', '开关数', '開關數', '스위치 수', 'Interruptores', 'Interrupteurs', 'Schalter', 'Interruptores', 'Interruttori', 'स्विच', 'Sakelar'],
  'settings.correct': ['正解スイッチ', 'Correct', '正确数', '正確數', '정답 수', 'Correctos', 'Corrects', 'Richtige', 'Corretos', 'Giusti', 'सही', 'Benar'],
  'settings.escape': ['スイッチ脱出', 'Switch escape', '开关逃脱', '開關逃脫', '스위치 탈출', 'Huida por interruptor', 'Fuite par interrupteur', 'Schalter-Flucht', 'Fuga por interruptor', 'Fuga con interruttore', 'स्विच से भागना', 'Kabur lewat sakelar'],
  'settings.escapeNote': [
    'ON＝スイッチでゲートを開けて脱出あり／OFF＝時間切れまで逃げ切る氷鬼',
    'ON = open a gate with the switches / OFF = ice tag until the clock runs out',
    '开＝用开关开门逃出／关＝坚持到时间结束的冰冻鬼',
    '開＝用開關開門逃出／關＝堅持到時間結束的冰凍鬼',
    '켜짐 = 스위치로 탈출 / 꺼짐 = 시간이 끝날 때까지 얼음 술래',
    'Sí = abrir una puerta con los interruptores / No = pillapilla hasta el final',
    'Oui = ouvrir une porte avec les interrupteurs / Non = chat glacé jusqu’à la fin',
    'An = Tor mit den Schaltern öffnen / Aus = Eis-Fangen bis zum Zeitende',
    'Lig = abrir portão com os interruptores / Desl = pega-pega até o fim',
    'Sì = aprire un cancello con gli interruttori / No = acchiapparello fino alla fine',
    'चालू = स्विच से गेट / बंद = समय तक बर्फ में पकड़म-पकड़ाई',
    'Aktif = buka gerbang dengan sakelar / Mati = kejar-kejaran sampai waktu habis',
  ],
  'settings.trap': ['罠スイッチ', 'Trap switch', '陷阱开关', '陷阱開關', '함정 스위치', 'Interruptor trampa', 'Interrupteur piège', 'Fallenschalter', 'Interruptor-armadilha', 'Interruttore trappola', 'जाल स्विच', 'Sakelar jebakan'],
  'trap.auto': ['人数連動（8人〜）', 'By players (8+)', '随人数（8人起）', '隨人數（8人起）', '인원 연동(8명~)', 'Según jugadores (8+)', 'Selon joueurs (8+)', 'Nach Spielern (8+)', 'Por jogadores (8+)', 'In base ai giocatori (8+)', 'खिलाड़ी संख्या (8+)', 'Ikut pemain (8+)'],
  'trap.always': ['常にON', 'Always ON', '常开', '常開', '항상 ON', 'Siempre', 'Toujours', 'Immer an', 'Sempre', 'Sempre', 'हमेशा', 'Selalu'],
  'trap.off': ['OFF', 'OFF', '关', '關', 'OFF', 'No', 'Non', 'Aus', 'Não', 'No', 'बंद', 'Mati'],
  'settings.proFeature': ['PROの機能です', 'This is a PRO feature', '这是PRO功能', '這是PRO功能', 'PRO 기능입니다', 'Función PRO', 'Fonction PRO', 'PRO-Funktion', 'Recurso PRO', 'Funzione PRO', 'PRO सुविधा', 'Fitur PRO'],
  'settings.appliesNext': ['次の試合から反映されます', 'Applies from the next match', '将从下一场开始生效', '將從下一場開始生效', '다음 경기부터 적용됩니다', 'Se aplica en la próxima partida', 'Dès la prochaine partie', 'Gilt ab der nächsten Runde', 'Vale na próxima partida', 'Dalla prossima partita', 'अगले मैच से लागू', 'Berlaku mulai pertandingan berikutnya'],
  'settings.sound': ['効果音', 'Sound', '音效', '音效', '효과음', 'Sonido', 'Sons', 'Sound', 'Som', 'Suoni', 'ध्वनि', 'Suara'],
  'settings.bgm': ['BGM', 'Music', '音乐', '音樂', '배경음악', 'Música', 'Musique', 'Musik', 'Música', 'Musica', 'संगीत', 'Musik'],
  'settings.vibration': ['バイブ', 'Vibration', '振动', '震動', '진동', 'Vibración', 'Vibration', 'Vibration', 'Vibração', 'Vibrazione', 'कंपन', 'Getar'],
  'settings.textSize': ['文字サイズ', 'Text size', '文字大小', '文字大小', '글자 크기', 'Tamaño de texto', 'Taille du texte', 'Textgröße', 'Tamanho do texto', 'Dimensione testo', 'अक्षर आकार', 'Ukuran teks'],
  'size.standard': ['標準', 'Standard', '标准', '標準', '표준', 'Normal', 'Normal', 'Standard', 'Padrão', 'Normale', 'सामान्य', 'Standar'],
  'size.large': ['大', 'Large', '大', '大', '크게', 'Grande', 'Grand', 'Groß', 'Grande', 'Grande', 'बड़ा', 'Besar'],
  'size.xlarge': ['特大', 'X-Large', '特大', '特大', '아주 크게', 'Muy grande', 'Très grand', 'Sehr groß', 'Muito grande', 'Molto grande', 'बहुत बड़ा', 'Sangat besar'],
  'settings.camera': ['カメラ', 'Camera', '镜头', '鏡頭', '카메라', 'Cámara', 'Caméra', 'Kamera', 'Câmera', 'Telecamera', 'कैमरा', 'Kamera'],
  'cam.normal': ['通常', 'Normal', '普通', '普通', '일반', 'Normal', 'Normale', 'Normal', 'Normal', 'Normale', 'सामान्य', 'Normal'],
  'cam.top': ['俯瞰', 'Overhead', '俯视', '俯視', '위에서', 'Cenital', 'Plongeante', 'Von oben', 'De cima', 'Dall’alto', 'ऊपर से', 'Dari atas'],
  'settings.controls': ['操作', 'Controls', '操作', '操作', '조작', 'Controles', 'Commandes', 'Steuerung', 'Controles', 'Controlli', 'नियंत्रण', 'Kontrol'],
  'controls.stick': ['固定スティック', 'Fixed stick', '固定摇杆', '固定搖桿', '고정 스틱', 'Stick fijo', 'Stick fixe', 'Fester Stick', 'Stick fixo', 'Stick fisso', 'स्थिर स्टिक', 'Stik tetap'],
  'controls.touch': ['画面どこでもタッチ', 'Drag anywhere', '全屏拖动', '全螢幕拖動', '화면 어디나 터치', 'Arrastrar en cualquier sitio', 'Glisser partout', 'Überall ziehen', 'Arrastar em qualquer lugar', 'Trascina ovunque', 'कहीं भी खींचें', 'Geser di mana saja'],
  'settings.language': ['言語', 'Language', '语言', '語言', '언어', 'Idioma', 'Langue', 'Sprache', 'Idioma', 'Lingua', 'भाषा', 'Bahasa'],
  'settings.privacy': ['プライバシーポリシー', 'Privacy policy', '隐私政策', '隱私政策', '개인정보 처리방침', 'Privacidad', 'Confidentialité', 'Datenschutz', 'Privacidade', 'Privacy', 'गोपनीयता', 'Privasi'],
  'settings.restore': ['購入を復元', 'Restore purchase', '恢复购买', '恢復購買', '구매 복원', 'Restaurar compra', 'Restaurer l’achat', 'Kauf wiederherstellen', 'Restaurar compra', 'Ripristina acquisto', 'खरीद बहाल करें', 'Pulihkan pembelian'],
  'settings.restored': ['PROを復元しました', 'PRO restored', '已恢复PRO', '已恢復PRO', 'PRO를 복원했습니다', 'PRO restaurado', 'PRO restauré', 'PRO wiederhergestellt', 'PRO restaurado', 'PRO ripristinato', 'PRO बहाल हुआ', 'PRO dipulihkan'],
  'settings.restoreFail': ['復元できる購入がありません', 'No purchase to restore', '没有可恢复的购买', '沒有可恢復的購買', '복원할 구매가 없습니다', 'No hay compra que restaurar', 'Aucun achat à restaurer', 'Kein Kauf zum Wiederherstellen', 'Nenhuma compra para restaurar', 'Nessun acquisto da ripristinare', 'बहाल करने के लिए खरीद नहीं', 'Tidak ada pembelian untuk dipulihkan'],
  'settings.resetConfirm': ['設定を初期化しますか？', 'Reset all settings?', '要重置设置吗？', '要重設設定嗎？', '설정을 초기화할까요?', '¿Reiniciar los ajustes?', 'Réinitialiser les réglages ?', 'Alle Einstellungen zurücksetzen?', 'Redefinir os ajustes?', 'Ripristinare le impostazioni?', 'सभी सेटिंग्स रीसेट करें?', 'Atur ulang semua pengaturan?'],

  /* ---------------- stages ---------------- */
  'stage.classic': ['クラシック・アイスアリーナ', 'Classic Ice Arena', '经典冰场', '經典冰場', '클래식 아이스 아레나', 'Arena de hielo clásica', 'Arène de glace classique', 'Klassische Eisarena', 'Arena de gelo clássica', 'Arena di ghiaccio classica', 'क्लासिक आइस एरिना', 'Arena Es Klasik'],
  'stage.aquarium': ['深海水族館', 'Deep-Sea Aquarium', '深海水族馆', '深海水族館', '심해 수족관', 'Acuario de aguas profundas', 'Aquarium des abysses', 'Tiefsee-Aquarium', 'Aquário do fundo do mar', 'Acquario degli abissi', 'गहरे समुद्र का एक्वेरियम', 'Akuarium Laut Dalam'],
  'stage.park': ['霧の遊園地', 'Misty Amusement Park', '迷雾游乐园', '迷霧遊樂園', '안개 유원지', 'Parque de la niebla', 'Parc brumeux', 'Nebel-Freizeitpark', 'Parque enevoado', 'Parco nella nebbia', 'धुंध वाला मनोरंजन पार्क', 'Taman Bermain Berkabut'],
  'stage.lodge': ['雪山ロッジ', 'Snowy Mountain Lodge', '雪山小屋', '雪山小屋', '설산 롯지', 'Refugio de montaña', 'Chalet de montagne', 'Berghütte', 'Chalé da montanha', 'Rifugio di montagna', 'बर्फीला पहाड़ी लॉज', 'Lodge Pegunungan Salju'],
  'stage.school': ['廃校', 'Abandoned School', '废弃学校', '廢棄學校', '폐교', 'Escuela abandonada', 'École abandonnée', 'Verlassene Schule', 'Escola abandonada', 'Scuola abbandonata', 'वीरान स्कूल', 'Sekolah Terbengkalai'],
  'stage.space': ['宇宙船', 'Spaceship', '宇宙飞船', '宇宙飛船', '우주선', 'Nave espacial', 'Vaisseau spatial', 'Raumschiff', 'Nave espacial', 'Astronave', 'अंतरिक्ष यान', 'Kapal Luar Angkasa'],
  'stage.classic.desc': ['見晴らしのよい広い氷の通路。まずはここから。', 'A wide, open ice arena. Start here.', '视野开阔的宽阔冰道。从这里开始。', '視野開闊的寬闊冰道。從這裡開始。', '탁 트인 넓은 얼음 통로. 여기서 시작하세요.', 'Una pista de hielo amplia y despejada. Empieza aquí.', 'Une large patinoire dégagée. Commencez ici.', 'Eine weite, offene Eisfläche. Hier beginnt es.', 'Uma pista de gelo ampla e aberta. Comece aqui.', 'Una pista di ghiaccio ampia e aperta. Inizia qui.', 'खुला और चौड़ा बर्फीला रास्ता। यहीं से शुरू करें।', 'Arena es luas dan terbuka. Mulai di sini.'],
  'stage.aquarium.desc': ['海流が押し流す深海の水槽。巨大マンタが横切る。', 'Deep-sea currents push you along; a giant manta glides past.', '海流会推动你，巨大蝠鲼横穿而过。', '海流會推動你，巨大蝠鱝橫穿而過。', '해류가 밀어내고 거대한 만타가 지나갑니다.', 'Las corrientes te empujan; una manta gigante cruza.', 'Les courants vous poussent ; une manta géante passe.', 'Strömungen schieben dich; ein riesiger Manta zieht vorbei.', 'As correntes empurram; uma manta gigante passa.', 'Le correnti ti spingono; una manta gigante passa.', 'धाराएँ धकेलती हैं; विशाल मांता गुज़रता है।', 'Arus mendorongmu; manta raksasa melintas.'],
  'stage.park.desc': ['霧とネオンの遊園地。パレードで全員加速。', 'Fog, neon and a parade that speeds everyone up.', '雾与霓虹的游乐园。巡游时全员加速。', '霧與霓虹的遊樂園。遊行時全員加速。', '안개와 네온의 유원지. 퍼레이드에서 모두 빨라집니다.', 'Niebla, neón y un desfile que acelera a todos.', 'Brouillard, néons et une parade qui accélère tout le monde.', 'Nebel, Neon und eine Parade, die alle schneller macht.', 'Neblina, neon e um desfile que acelera todos.', 'Nebbia, neon e una parata che accelera tutti.', 'धुंध, नियॉन और परेड में सब तेज़।', 'Kabut, neon, dan parade yang mempercepat semua.'],
  'stage.lodge.desc': ['暖炉と吹雪の山小屋。北の通路は氷床で滑る。', 'A hearth, a blizzard and a slippery ice corridor.', '暖炉与暴风雪的雪屋。北侧通道是滑冰。', '暖爐與暴風雪的雪屋。北側通道是滑冰。', '벽난로와 눈보라의 산장. 북쪽 통로는 얼음판입니다.', 'Una chimenea, una ventisca y un pasillo de hielo.', 'Une cheminée, une tempête et un couloir de glace.', 'Ein Kamin, ein Schneesturm und ein eisiger Gang.', 'Uma lareira, uma nevasca e um corredor de gelo.', 'Un camino, una bufera e un corridoio di ghiaccio.', 'चूल्हा, बर्फीला तूफ़ान और फिसलन भरा रास्ता।', 'Perapian, badai salju, dan lorong es yang licin.'],
  'stage.school.desc': ['廃校の教室。チャイムのあとドアが5秒閉まる。', 'Classroom doors shut for five seconds after the chime.', '废弃学校的教室。铃声后门会关闭5秒。', '廢棄學校的教室。鈴聲後門會關閉5秒。', '폐교 교실. 종이 울린 뒤 문이 5초 닫힙니다.', 'Las puertas se cierran 5 s tras el timbre.', 'Les portes se ferment 5 s après la sonnerie.', 'Türen schließen 5 s nach dem Gong.', 'As portas fecham por 5 s após o sinal.', 'Le porte si chiudono 5 s dopo il suono.', 'घंटी के बाद दरवाज़े 5 सेकंड बंद।', 'Pintu kelas tertutup 5 detik setelah bel.'],
  'stage.space.desc': ['低重力の宇宙船。高重力マスが湧き出す。', 'Low gravity, and high-gravity cells that flare up.', '低重力的宇宙船。高重力格会出现。', '低重力的宇宙飛船。高重力格會出現。', '저중력 우주선. 고중력 칸이 나타납니다.', 'Baja gravedad y celdas de alta gravedad.', 'Basse gravité et cellules de forte gravité.', 'Niedrige Schwerkraft und Hochschwerkraft-Felder.', 'Baixa gravidade e células de alta gravidade.', 'Bassa gravità e celle di alta gravità.', 'कम गुरुत्व, और उच्च गुरुत्व के खाने।', 'Gravitasi rendah dan sel gravitasi tinggi.'],
  'stage.proTag': ['PROステージ', 'PRO stage', 'PRO关卡', 'PRO關卡', 'PRO 스테이지', 'Escenario PRO', 'Terrain PRO', 'PRO-Arena', 'Palco PRO', 'Arena PRO', 'PRO मैदान', 'Arena PRO'],

  /* ---------------- pro ---------------- */
  'pro.title': ['ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO', 'ICE WOLF PRO'],
  'pro.subtitle': ['買い切り。一度買えばずっと使えます。', 'One-time purchase. Yours for good.', '买断制。一次购买永久使用。', '買斷制。一次購買永久使用。', '한 번 구매로 계속 사용.', 'Compra única para siempre.', 'Achat unique, pour toujours.', 'Einmal kaufen, für immer.', 'Compra única, para sempre.', 'Acquisto unico, per sempre.', 'एक बार खरीदें, हमेशा के लिए।', 'Sekali beli, selamanya.'],
  'pro.f1': ['PROステージ4つ（遊園地・ロッジ・廃校・宇宙船）', 'Four PRO stages (park, lodge, school, spaceship)', '4个PRO关卡（游乐园、小屋、学校、飞船）', '4個PRO關卡（遊樂園、小屋、學校、飛船）', 'PRO 스테이지 4개(유원지·산장·폐교·우주선)', 'Cuatro escenarios PRO', 'Quatre terrains PRO', 'Vier PRO-Arenen', 'Quatro palcos PRO', 'Quattro arene PRO', 'चार PRO मैदान', 'Empat arena PRO'],
  'pro.f2': ['10人戦・2人狼・スイッチ3/5/7/10・正解5・1分戦', '10 players, two wolves, 3/5/7/10 switches, 5 correct, 1-minute matches', '10人战・双人狼・开关3/5/7/10・正确5・1分钟', '10人戰・雙人狼・開關3/5/7/10・正確5・1分鐘', '10인전·늑대 2·스위치 3/5/7/10·정답 5·1분', '10 jugadores, dos lobos, reglas a medida', '10 joueurs, deux loups, règles à la carte', '10 Spieler, zwei Wölfe, eigene Regeln', '10 jogadores, dois lobos, regras próprias', '10 giocatori, due lupi, regole libere', '10 खिलाड़ी, दो भेड़िये, कस्टम नियम', '10 pemain, dua serigala, aturan khusus'],
  'pro.f3': ['オンラインで部屋を作る（合言葉6文字）', 'Create online rooms (six-character code)', '创建在线房间（6位口令）', '建立線上房間（6位口令）', '온라인 방 만들기(6자리 코드)', 'Crear salas en línea (código de 6)', 'Créer des salons (code de 6)', 'Online-Räume erstellen (6 Zeichen)', 'Criar salas online (código de 6)', 'Creare stanze online (codice di 6)', 'ऑनलाइन कमरा बनाएँ (6 अक्षर)', 'Buat ruang daring (kode 6 karakter)'],
  'pro.buy': ['PROを購入', 'Buy PRO', '购买PRO', '購買PRO', 'PRO 구매', 'Comprar PRO', 'Acheter PRO', 'PRO kaufen', 'Comprar PRO', 'Acquista PRO', 'PRO खरीदें', 'Beli PRO'],
  'pro.owned': ['PRO 購入済み', 'PRO owned', '已拥有PRO', '已擁有PRO', 'PRO 구매 완료', 'PRO comprado', 'PRO acheté', 'PRO gekauft', 'PRO comprado', 'PRO acquistato', 'PRO खरीदा', 'PRO dimiliki'],
  'pro.note': ['価格はApp Storeが表示する金額です。購入の復元は設定から。', 'The price is what the App Store shows. Restore from settings.', '价格以App Store显示为准。可在设置中恢复购买。', '價格以App Store顯示為準。可在設定中恢復購買。', '가격은 App Store 표시 금액입니다. 설정에서 복원할 수 있습니다.', 'El precio lo muestra la App Store. Restaura desde ajustes.', 'Le prix est celui de l’App Store. Restauration dans les réglages.', 'Der Preis kommt aus dem App Store. Wiederherstellen in den Einstellungen.', 'O preço é o da App Store. Restaure nos ajustes.', 'Il prezzo è quello dell’App Store. Ripristino dalle impostazioni.', 'कीमत App Store दिखाता है। सेटिंग्स से बहाल करें।', 'Harga mengikuti App Store. Pulihkan dari pengaturan.'],
  'pro.thanks': ['ありがとうございます！PROが有効になりました。', 'Thank you! PRO is active.', '谢谢！PRO已启用。', '謝謝！PRO已啟用。', '감사합니다! PRO가 활성화되었습니다.', '¡Gracias! PRO está activo.', 'Merci ! PRO est actif.', 'Danke! PRO ist aktiv.', 'Obrigado! PRO está ativo.', 'Grazie! PRO è attivo.', 'धन्यवाद! PRO चालू है।', 'Terima kasih! PRO aktif.'],

  /* ---------------- online ---------------- */
  'online.title': ['オンライン対戦', 'ONLINE MATCH', '在线对战', '線上對戰', '온라인 대전', 'PARTIDA EN LÍNEA', 'PARTIE EN LIGNE', 'ONLINE-PARTIE', 'PARTIDA ONLINE', 'PARTITA ONLINE', 'ऑनलाइन मैच', 'PERTANDINGAN DARING'],
  'online.create': ['部屋を作る', 'Create room', '创建房间', '建立房間', '방 만들기', 'Crear sala', 'Créer un salon', 'Raum erstellen', 'Criar sala', 'Crea stanza', 'कमरा बनाएँ', 'Buat ruang'],
  'online.join': ['合言葉で入る', 'Join with code', '用口令进入', '用口令進入', '코드로 입장', 'Entrar con código', 'Entrer avec un code', 'Mit Code beitreten', 'Entrar com código', 'Entra con codice', 'कोड से जुड़ें', 'Gabung dengan kode'],
  'online.code': ['合言葉', 'Room code', '房间口令', '房間口令', '방 코드', 'Código', 'Code', 'Raumcode', 'Código', 'Codice', 'कमरा कोड', 'Kode ruang'],
  'online.name': ['表示名', 'Display name', '显示名', '顯示名', '표시 이름', 'Nombre', 'Nom', 'Anzeigename', 'Nome', 'Nome', 'नाम', 'Nama'],
  'online.copy': ['コピー', 'Copy', '复制', '複製', '복사', 'Copiar', 'Copier', 'Kopieren', 'Copiar', 'Copia', 'कॉपी', 'Salin'],
  'online.copied': ['コピーしました', 'Copied', '已复制', '已複製', '복사했습니다', 'Copiado', 'Copié', 'Kopiert', 'Copiado', 'Copiato', 'कॉपी हुआ', 'Disalin'],
  'online.leave': ['退出', 'Leave', '退出', '退出', '나가기', 'Salir', 'Quitter', 'Verlassen', 'Sair', 'Esci', 'छोड़ें', 'Keluar'],
  'online.start': ['試合開始', 'Start match', '开始比赛', '開始比賽', '경기 시작', 'Empezar', 'Lancer', 'Starten', 'Começar', 'Inizia', 'मैच शुरू', 'Mulai'],
  'online.waiting': ['ホストの開始を待っています…', 'Waiting for the host…', '等待房主开始…', '等待房主開始…', '호스트의 시작을 기다리는 중…', 'Esperando al anfitrión…', 'En attente de l’hôte…', 'Warte auf den Host…', 'Aguardando o anfitrião…', 'In attesa dell’host…', 'होस्ट की प्रतीक्षा…', 'Menunggu host…'],
  'online.practice': ['練習', 'PRACTICE', '练习', '練習', '연습', 'PRÁCTICA', 'ENTRAÎNEMENT', 'ÜBUNG', 'PRÁTICA', 'PROVA', 'अभ्यास', 'LATIHAN'],
  'online.live': ['サーバー接続', 'LIVE', '已联机', '已連線', '서버 연결', 'EN VIVO', 'EN LIGNE', 'LIVE', 'AO VIVO', 'ONLINE', 'लाइव', 'LIVE'],
  'online.notConfigured': ['オンラインの設定がまだです', 'Online is not set up yet', '在线尚未配置', '線上尚未設定', '온라인이 아직 설정되지 않았습니다', 'Las partidas en línea no están configuradas', 'Le jeu en ligne n’est pas configuré', 'Online ist noch nicht eingerichtet', 'O online ainda não está configurado', 'L’online non è configurato', 'ऑनलाइन अभी सेट नहीं है', 'Daring belum diatur'],
  'online.connecting': ['接続中…', 'Connecting…', '连接中…', '連線中…', '연결 중…', 'Conectando…', 'Connexion…', 'Verbinde…', 'Conectando…', 'Connessione…', 'कनेक्ट हो रहा है…', 'Menghubungkan…'],
  'online.ready': ['準備OK', 'READY', '准备OK', '準備OK', '준비 완료', 'LISTO', 'PRÊT', 'BEREIT', 'PRONTO', 'PRONTO', 'तैयार', 'SIAP'],
  'online.players': ['{n}人', '{n} players', '{n}人', '{n}人', '{n}명', '{n} jugadores', '{n} joueurs', '{n} Spieler', '{n} jogadores', '{n} giocatori', '{n} खिलाड़ी', '{n} pemain'],
  'online.needCode': ['6文字の合言葉を入れてください', 'Enter the six-character code', '请输入6位口令', '請輸入6位口令', '6자리 코드를 입력하세요', 'Escribe el código de 6 caracteres', 'Entrez le code de 6 caractères', 'Gib den 6-stelligen Code ein', 'Digite o código de 6 caracteres', 'Inserisci il codice di 6 caratteri', '6 अक्षर का कोड डालें', 'Masukkan kode 6 karakter'],
  'online.joinFail': ['入室できませんでした。合言葉を確認してください。', 'Could not join. Check the code.', '无法进入。请确认口令。', '無法進入。請確認口令。', '입장하지 못했습니다. 코드를 확인하세요.', 'No se pudo entrar. Revisa el código.', 'Entrée impossible. Vérifiez le code.', 'Beitritt fehlgeschlagen. Prüfe den Code.', 'Não foi possível entrar. Verifique o código.', 'Impossibile entrare. Controlla il codice.', 'प्रवेश नहीं हुआ। कोड जाँचें।', 'Gagal bergabung. Periksa kode.'],
  'online.full': ['部屋が満員です', 'The room is full', '房间已满', '房間已滿', '방이 가득 찼습니다', 'La sala está llena', 'Le salon est plein', 'Der Raum ist voll', 'A sala está cheia', 'La stanza è piena', 'कमरा भरा है', 'Ruang penuh'],
  'online.hostLost': ['ホストとの通信が切れました。試合を終了します。', 'Lost the host. Ending the match.', '与房主断开。比赛结束。', '與房主斷開。比賽結束。', '호스트와 연결이 끊겼습니다. 경기를 종료합니다.', 'Se perdió al anfitrión. Fin de la partida.', 'Hôte perdu. Fin de la partie.', 'Host verloren. Partie endet.', 'Host perdido. Encerrando a partida.', 'Host perso. Partita terminata.', 'होस्ट से संपर्क टूटा। मैच समाप्त।', 'Koneksi host hilang. Pertandingan berakhir.'],
  'online.proStage': ['このステージはPRO専用です', 'This stage needs PRO', '此关卡需要PRO', '此關卡需要PRO', '이 스테이지는 PRO 전용입니다', 'Este escenario requiere PRO', 'Ce terrain exige PRO', 'Diese Arena braucht PRO', 'Este palco exige PRO', 'Questa arena richiede PRO', 'यह मैदान PRO चाहता है', 'Arena ini butuh PRO'],
  'online.host': ['ホスト', 'HOST', '房主', '房主', '호스트', 'ANFITRIÓN', 'HÔTE', 'HOST', 'ANFITRIÃO', 'HOST', 'होस्ट', 'HOST'],
  'online.hint': ['同じ合言葉を友達に伝えると、同じ部屋に入れます。', 'Share the code and your friends join the same room.', '把口令告诉朋友，就能进入同一房间。', '把口令告訴朋友，就能進入同一房間。', '같은 코드를 친구에게 알려 주면 같은 방에 들어옵니다.', 'Comparte el código y tus amigos entran a la misma sala.', 'Partagez le code et vos amis rejoignent le salon.', 'Teile den Code, dann kommen Freunde in denselben Raum.', 'Compartilhe o código e os amigos entram na mesma sala.', 'Condividi il codice e gli amici entrano nella stanza.', 'कोड साझा करें, दोस्त उसी कमरे में आएँगे।', 'Bagikan kode dan teman masuk ke ruang yang sama.'],
  'online.stampCooldown': ['少し待ってから', 'Wait a moment', '稍等一下', '稍等一下', '잠시 후', 'Espera un poco', 'Un instant', 'Kurz warten', 'Aguarde um pouco', 'Aspetta un attimo', 'थोड़ा रुकें', 'Tunggu sebentar'],

  /* ---------------- HUD ---------------- */
  'hud.role': ['役割', 'ROLE', '身份', '身份', '역할', 'PAPEL', 'RÔLE', 'ROLLE', 'PAPEL', 'RUOLO', 'भूमिका', 'PERAN'],
  'role.human.label': ['人間', 'HUMAN', '人类', '人類', '인간', 'HUMANO', 'HUMAIN', 'MENSCH', 'HUMANO', 'UMANO', 'इंसान', 'MANUSIA'],
  'role.wolf.label': ['マスター鬼', 'MASTER WOLF', '首领鬼', '首領鬼', '마스터 늑대', 'LOBO MAESTRO', 'LOUP MAÎTRE', 'MEISTERWOLF', 'LOBO MESTRE', 'LUPO MAESTRO', 'मास्टर भेड़िया', 'SERIGALA MASTER'],
  'role.werewolf.label': ['人狼鬼', 'WEREWOLF', '人狼鬼', '人狼鬼', '늑대인간', 'HOMBRE LOBO', 'LOUP-GAROU', 'WERWOLF', 'LOBISOMEM', 'LUPO MANNARO', 'वेयरवुल्फ', 'MANUSIA SERIGALA'],
  'hud.alive': ['生存', 'ALIVE', '存活', '存活', '생존', 'VIVOS', 'VIVANTS', 'LEBEND', 'VIVOS', 'VIVI', 'ज़िंदा', 'HIDUP'],
  'hud.frozen': ['凍結', 'FROZEN', '冻结', '凍結', '얼음', 'CONGELADOS', 'GELÉS', 'EINGEFROREN', 'CONGELADOS', 'CONGELATI', 'जमे', 'BEKU'],
  'hud.switch': ['スイッチ {n}/{t}', 'SWITCH {n}/{t}', '开关 {n}/{t}', '開關 {n}/{t}', '스위치 {n}/{t}', 'INTERRUPTOR {n}/{t}', 'INTERRUPTEUR {n}/{t}', 'SCHALTER {n}/{t}', 'INTERRUPTOR {n}/{t}', 'INTERRUTTORE {n}/{t}', 'स्विच {n}/{t}', 'SAKELAR {n}/{t}'],
  'hud.gate': ['ゲート', 'GATE', '大门', '大門', '게이트', 'PUERTA', 'PORTE', 'TOR', 'PORTÃO', 'CANCELLO', 'गेट', 'GERBANG'],
  'hud.gateClosed': ['閉鎖中', 'SHUT', '关闭中', '關閉中', '닫힘', 'CERRADA', 'FERMÉE', 'ZU', 'FECHADO', 'CHIUSO', 'बंद', 'TERTUTUP'],
  'hud.gateOpened': ['開放！{f}F', 'OPEN! {f}F', '开启！{f}F', '開啟！{f}F', '열림! {f}F', '¡ABIERTA! {f}F', 'OUVERTE ! {f}F', 'OFFEN! {f}F', 'ABERTO! {f}F', 'APERTO! {f}F', 'खुला! {f}F', 'TERBUKA! {f}F'],
  'hud.floor': ['{n}F', '{n}F', '{n}F', '{n}F', '{n}F', '{n}F', '{n}F', '{n}F', '{n}F', '{n}F', '{n}F', '{n}F'],
  'hud.time': ['のこり', 'LEFT', '剩余', '剩餘', '남은 시간', 'QUEDA', 'RESTE', 'REST', 'RESTA', 'RESTA', 'बाकी', 'SISA'],
  'hud.switchOn': ['スイッチ起動！（{n}/{t}）', 'Switch on! ({n}/{t})', '开关启动！（{n}/{t}）', '開關啟動！（{n}/{t}）', '스위치 작동! ({n}/{t})', '¡Interruptor activo! ({n}/{t})', 'Interrupteur activé ! ({n}/{t})', 'Schalter an! ({n}/{t})', 'Interruptor ligado! ({n}/{t})', 'Interruttore attivo! ({n}/{t})', 'स्विच चालू! ({n}/{t})', 'Sakelar aktif! ({n}/{t})'],
  'hud.switchMiss': ['ハズレのスイッチでした', 'That switch was a dummy', '这是假开关', '這是假開關', '빗나간 스위치입니다', 'Ese interruptor era falso', 'Cet interrupteur était faux', 'Das war ein Blindschalter', 'Esse interruptor era falso', 'Quell’interruttore era falso', 'वह नकली स्विच था', 'Sakelar itu palsu'],
  'hud.switchTrap': ['罠スイッチ！人狼鬼になった', 'Trap switch! You are a werewolf now', '陷阱开关！你变成人狼鬼了', '陷阱開關！你變成人狼鬼了', '함정 스위치! 늑대인간이 되었습니다', '¡Trampa! Ahora eres hombre lobo', 'Piège ! Vous êtes loup-garou', 'Falle! Du bist jetzt Werwolf', 'Armadilha! Agora você é lobisomem', 'Trappola! Ora sei un lupo mannaro', 'जाल! अब तुम वेयरवुल्फ हो', 'Jebakan! Kau kini manusia serigala'],
  'hud.freeze': ['凍った！仲間の救助を待て', 'Frozen! Wait for a rescue', '冻结了！等待同伴救助', '凍結了！等待同伴救助', '얼었습니다! 동료의 구조를 기다리세요', '¡Congelado! Espera un rescate', 'Gelé ! Attendez un sauvetage', 'Eingefroren! Warte auf Rettung', 'Congelado! Espere um resgate', 'Congelato! Attendi un salvataggio', 'जम गए! बचाव की प्रतीक्षा करें', 'Membeku! Tunggu pertolongan'],
  'hud.rescued': ['救助した！', 'Rescued!', '已救助！', '已救助！', '구출했습니다!', '¡Rescatado!', 'Secouru !', 'Gerettet!', 'Resgatado!', 'Salvato!', 'बचा लिया!', 'Diselamatkan!'],
  'hud.thawed': ['解凍された！', 'Thawed!', '解冻了！', '解凍了！', '해동되었습니다!', '¡Descongelado!', 'Dégelé !', 'Aufgetaut!', 'Descongelado!', 'Scongelato!', 'पिघल गए!', 'Mencair!'],
  'hud.wolfOn': ['人狼モード！', 'WOLF MODE!', '人狼模式！', '人狼模式！', '늑대 모드!', '¡MODO LOBO!', 'MODE LOUP !', 'WOLF-MODUS!', 'MODO LOBO!', 'MODALITÀ LUPO!', 'वुल्फ मोड!', 'MODE SERIGALA!'],
  'hud.wolfOff': ['人狼モード終了', 'Wolf Mode over', '人狼模式结束', '人狼模式結束', '늑대 모드 종료', 'Fin del Modo Lobo', 'Fin du Mode Loup', 'Wolf-Modus vorbei', 'Fim do Modo Lobo', 'Fine Modalità Lupo', 'वुल्फ मोड खत्म', 'Mode Serigala selesai'],
  'hud.infect': ['人狼鬼に指名した', 'Named as a werewolf', '已指定为人狼鬼', '已指定為人狼鬼', '늑대인간으로 지목', 'Marcado como hombre lobo', 'Glace marquée loup-garou', 'Als Werwolf markiert', 'Marcado como lobisomem', 'Marcato come lupo mannaro', 'वेयरवुल्फ चुना', 'Ditandai manusia serigala'],
  'hud.frozeOther': ['凍らせた！', 'FROZEN!', '冻结成功！', '凍結成功！', '얼렸다!', '¡Congelado!', 'Gelé !', 'Eingefroren!', 'Congelado!', 'Congelato!', 'जमा दिया!', 'Membekukan!'],
  'hud.freezeBy': [
    '{name} に凍らされた！仲間の救助を待て',
    '{name} froze you! Wait for a rescue',
    '被{name}冻结了！等待同伴救助',
    '被{name}凍結了！等待同伴救助',
    '{name}에게 얼었습니다! 동료의 구조를 기다리세요',
    '¡{name} te congeló! Espera un rescate',
    '{name} vous a gelé ! Attendez un sauvetage',
    '{name} hat dich eingefroren! Warte auf Rettung',
    '{name} congelou você! Espere um resgate',
    '{name} ti ha congelato! Attendi un salvataggio',
    '{name} ने जमा दिया! बचाव की प्रतीक्षा करें',
    '{name} membekukanmu! Tunggu pertolongan',
  ],
  'hud.trapIce': [
    '罠の氷だった！あなたは人狼鬼になった',
    'That was trap ice! You are a werewolf now',
    '是陷阱冰块！你变成了人狼鬼',
    '是陷阱冰塊！你變成了人狼鬼',
    '함정 얼음이었다! 늑대인간이 되었습니다',
    '¡Era hielo trampa! Ahora eres hombre lobo',
    'C’était de la glace piégée ! Vous êtes loup-garou',
    'Das war Falleneis! Du bist jetzt Werwolf',
    'Era gelo-armadilha! Agora você é lobisomem',
    'Era ghiaccio trappola! Ora sei un lupo mannaro',
    'वह जाल की बर्फ थी! अब तुम वेयरवुल्फ हो',
    'Itu es jebakan! Kau kini manusia serigala',
  ],
  'hud.trapSprang': ['罠！救助した人が人狼鬼に', 'Trap! The rescuer became a werewolf', '陷阱！救助者变成了人狼鬼', '陷阱！救助者變成了人狼鬼', '함정! 구한 사람이 늑대인간이 되었습니다', '¡Trampa! El rescatador es hombre lobo', 'Piège ! Le sauveteur est loup-garou', 'Falle! Der Retter ist Werwolf', 'Armadilha! O resgatador virou lobisomem', 'Trappola! Chi salva è lupo mannaro', 'जाल! बचाने वाला वेयरवुल्फ बना', 'Jebakan! Penyelamat jadi manusia serigala'],
  'hud.camFrozen': ['スティックで視点移動・CAMで自分中心', 'Stick moves the camera · CAM recentres you', '摇杆移动视角·CAM回到自己', '搖桿移動視角·CAM回到自己', '스틱으로 시점 이동·CAM은 나 중심', 'El stick mueve la cámara · CAM te recentra', 'Le stick déplace la caméra · CAM te recentre', 'Stick bewegt die Kamera · CAM zentriert dich', 'O stick move a câmera · CAM recentra você', 'Lo stick muove la camera · CAM ti ricentra', 'स्टिक से कैमरा · CAM से अपने केंद्र पर', 'Stik menggerakkan kamera · CAM kembali ke kamu'],
  'hud.hintFrozen': ['凍った！仲間の救助を待ちながらスティックで見回せる', 'Frozen! Wait for a rescue — the stick looks around', '冻结了！等同伴救助时可用摇杆环视', '凍結了！等同伴救助時可用搖桿環視', '얼었습니다! 동료 구조를 기다리며 스틱으로 둘러보세요', '¡Congelado! Espera el rescate: el stick mira alrededor', 'Gelé ! Attendez un sauvetage : le stick regarde autour', 'Eingefroren! Warte auf Rettung — der Stick schaut umher', 'Congelado! Espere o resgate; o stick olha em volta', 'Congelato! Attendi i soccorsi: lo stick guarda intorno', 'जम गए! बचाव की प्रतीक्षा करें — स्टिक से देखें', 'Membeku! Tunggu pertolongan — stik untuk melihat sekitar'],
  'hud.spectate': ['観戦中: {name}', 'Watching: {name}', '观战中：{name}', '觀戰中：{name}', '관전 중: {name}', 'Mirando: {name}', 'Observation : {name}', 'Zuschauen: {name}', 'Assistindo: {name}', 'Osservi: {name}', 'देख रहे: {name}', 'Menonton: {name}'],
  'hud.hintMove': ['スティックで移動。ボタンは指を取られません。', 'Move with the stick. Buttons never steal your finger.', '用摇杆移动。按钮不会抢走手指。', '用搖桿移動。按鈕不會搶走手指。', '스틱으로 이동. 버튼이 손가락을 가져가지 않습니다.', 'Muévete con el stick. Los botones no roban el dedo.', 'Déplacez-vous au stick. Les boutons ne volent pas le doigt.', 'Mit dem Stick bewegen. Buttons stehlen keinen Finger.', 'Mova com o stick. Os botões não roubam o dedo.', 'Muoviti con lo stick. I pulsanti non rubano il dito.', 'स्टिक से चलें। बटन उँगली नहीं लेते।', 'Bergerak dengan stik. Tombol tidak mencuri jari.'],
  'hud.hintRescue': ['凍った仲間の近くで「救助」を長押し', 'Hold RESCUE near a frozen teammate', '在冻结同伴旁长按“救助”', '在凍結同伴旁長按「救助」', '얼어붙은 동료 옆에서 구출을 길게', 'Mantén RESCATE junto a un congelado', 'Maintenez SECOURS près d’un gelé', 'RETTEN neben einem Eingefrorenen halten', 'Segure RESGATE perto de um congelado', 'Tieni SALVA vicino a un congelato', 'जमे साथी के पास बचाओ दबाएँ', 'Tahan SELAMATKAN dekat rekan beku'],
  'hud.hintSwitch': ['スイッチの前で「救助」を長押し（1.6秒）', 'Hold RESCUE at a switch (1.6 s)', '在开关前长按“救助”（1.6秒）', '在開關前長按「救助」（1.6秒）', '스위치 앞에서 구출을 길게(1.6초)', 'Mantén RESCATE en un interruptor (1,6 s)', 'Maintenez SECOURS sur un interrupteur (1,6 s)', 'RETTEN am Schalter halten (1,6 s)', 'Segure RESGATE no interruptor (1,6 s)', 'Tieni SALVA sull’interruttore (1,6 s)', 'स्विच पर बचाओ दबाएँ (1.6 सेकंड)', 'Tahan SELAMATKAN di sakelar (1,6 dtk)'],
  'hud.hintGate': ['開いたゲートへ急げ！触れれば人間の勝利', 'Run for the open gate! Touch it to win', '冲向开启的大门！碰到即胜利', '衝向開啟的大門！碰到即勝利', '열린 게이트로! 닿으면 승리', '¡Corre a la puerta abierta!', 'Courez à la porte ouverte !', 'Zum offenen Tor!', 'Corra para o portão aberto!', 'Corri al cancello aperto!', 'खुले गेट की ओर!', 'Lari ke gerbang terbuka!'],
  'hud.hintWolf': ['人狼モードで人間に触れて凍らせろ', 'Wolf Mode: touch humans to freeze them', '人狼模式：触碰人类冻结他', '人狼模式：觸碰人類凍結他', '늑대 모드: 인간을 얼리세요', 'Modo Lobo: congela a los humanos', 'Mode Loup : gelez les humains', 'Wolf-Modus: Menschen einfrieren', 'Modo Lobo: congele os humanos', 'Modalità Lupo: congela gli umani', 'वुल्फ मोड: इंसानों को जमाओ', 'Mode Serigala: bekukan manusia'],
  'hud.hintMasterWolf': [
    'マスター鬼はずっと鬼。触れるだけで人間を凍らせる',
    'Master wolf: a wolf all match. Touch a human to freeze them',
    '首领鬼整场都是鬼。碰到人类就冻结',
    '首領鬼整場都是鬼。碰到人類就凍結',
    '마스터 늑대는 경기 내내 늑대. 스치기만 해도 얼립니다',
    'El lobo maestro es lobo toda la partida. Tocar congela',
    'Le loup maître reste loup. Une touche gèle',
    'Der Meisterwolf bleibt Wolf. Berührung friert ein',
    'O lobo mestre é lobo a partida inteira. Tocar congela',
    'Il lupo maestro resta lupo. Un tocco congela',
    'मास्टर भेड़िया पूरे मैच भेड़िया। छूते ही जमाता है',
    'Serigala master tetap serigala. Sentuhan membekukan',
  ],
  'hud.hintTransform': ['「変身」で人狼鬼になれる。人間に戻ればバレない', 'TRANSFORM to become the wolf; turn human to hide', '“变身”成为人狼鬼，变回人就看不出来', '「變身」成為人狼鬼，變回人就看不出來', '변신으로 늑대가 되고, 인간으로 숨으세요', 'TRANSFORMA y vuelve a humano para esconderte', 'TRANSFORMEZ-vous, puis redevenez humain pour vous cacher', 'VERWANDELN, dann als Mensch verstecken', 'TRANSFORME e volte a humano para se esconder', 'TRASFORMA e torna umano per nasconderti', 'बदलो, फिर इंसान बनकर छिपो', 'UBERLAH, lalu kembali manusia untuk bersembunyi'],
  'hud.hintInfect': ['凍った人間を「人狼鬼」に指名できる（1試合1回・マスター鬼のみ）', 'Name one frozen human as a werewolf (once per match, master wolf only)', '可把1名被冻结的人类指定为人狼鬼（每场1次・仅首领鬼）', '可把1名被凍結的人類指定為人狼鬼（每場1次・僅首領鬼）', '얼어붙은 인간 한 명을 늑대인간으로 지목 (경기당 1회·마스터 늑대만)', 'Marca un congelado como hombre lobo (1 vez por partida, solo el lobo maestro)', 'Marquez un gelé comme loup-garou (1 fois par partie, loup maître seulement)', 'Einen Eingefrorenen als Werwolf markieren (1× pro Partie, nur Meisterwolf)', 'Marque um congelado como lobisomem (1× por partida, só o lobo mestre)', 'Segna un congelato come lupo mannaro (1 volta a partita, solo lupo maestro)', 'एक जमे इंसान को वेयरवुल्फ चुनो (प्रति मैच 1 बार, सिर्फ़ मास्टर भेड़िया)', 'Tandai satu yang beku sebagai manusia serigala (1× per pertandingan, hanya serigala master)'],
  'hud.hintEscape': ['時間切れまで生き残れば人間の勝利', 'Survive until the clock ends and humans win', '坚持到时间结束人类获胜', '堅持到時間結束人類獲勝', '시간이 끝날 때까지 살아남으면 인간 승리', 'Si sobrevives al reloj, ganan los humanos', 'Survivez jusqu’à la fin : les humains gagnent', 'Überlebt bis zum Ende: Menschen gewinnen', 'Sobreviva até o fim: humanos vencem', 'Sopravvivi fino alla fine: vincono gli umani', 'समय तक ज़िंदा रहो: इंसान जीतेंगे', 'Bertahan sampai waktu habis: manusia menang'],  'hud.noTarget': ['近くに救助できる相手がいません', 'Nobody to rescue here', '附近没有可救助的人', '附近沒有可救助的人', '가까이에 구할 사람이 없습니다', 'No hay nadie que rescatar', 'Personne à secourir', 'Niemand zum Retten hier', 'Ninguém para resgatar', 'Nessuno da salvare', 'यहाँ बचाने वाला कोई नहीं', 'Tidak ada yang bisa diselamatkan'],
  'hud.blocked': ['まだ人狼モードは使えません', 'Wolf Mode is not ready', '人狼模式还不能用', '人狼模式還不能用', '늑대 모드를 아직 쓸 수 없습니다', 'El Modo Lobo no está listo', 'Mode Loup indisponible', 'Wolf-Modus noch nicht bereit', 'Modo Lobo indisponível', 'Modalità Lupo non pronta', 'वुल्फ मोड अभी तैयार नहीं', 'Mode Serigala belum siap'],

  /* ---------------- CPU / other players log ---------------- */
  'log.freeze': [
    '{by} が {name} を凍らせた',
    '{by} froze {name}',
    '{by}冻结了{name}',
    '{by}凍結了{name}',
    '{by}가 {name}를 얼림',
    '{by} congeló a {name}',
    '{by} a gelé {name}',
    '{by} fror {name} ein',
    '{by} congelou {name}',
    '{by} ha congelato {name}',
    '{by} ने {name} को जमाया',
    '{by} membekukan {name}',
  ],
  'log.rescue': [
    '{by} が {name} を救助',
    '{by} rescued {name}',
    '{by}救助了{name}',
    '{by}救助了{name}',
    '{by}가 {name}를 구출',
    '{by} rescató a {name}',
    '{by} a secouru {name}',
    '{by} rettete {name}',
    '{by} resgatou {name}',
    '{by} ha salvato {name}',
    '{by} ने {name} को बचाया',
    '{by} menyelamatkan {name}',
  ],
  'log.trap': [
    '{name} が罠の氷を救助 → 人狼鬼',
    '{name} rescued trap ice → werewolf',
    '{name}救助了陷阱冰块 → 人狼鬼',
    '{name}救助了陷阱冰塊 → 人狼鬼',
    '{name}가 함정 얼음을 구출 → 늑대인간',
    '{name} rescató hielo trampa → hombre lobo',
    '{name} a secouru la glace piégée → loup-garou',
    '{name} rettete Falleneis → Werwolf',
    '{name} resgatou gelo-armadilha → lobisomem',
    '{name} ha salvato ghiaccio trappola → lupo mannaro',
    '{name} ने जाल की बर्फ बचाई → वेयरवुल्फ',
    '{name} menyelamatkan es jebakan → manusia serigala',
  ],
  'log.switchOn': [
    '{name}: スイッチ起動（{n}/{t}）',
    '{name}: switch on ({n}/{t})',
    '{name}：开关启动（{n}/{t}）',
    '{name}：開關啟動（{n}/{t}）',
    '{name}: 스위치 작동 ({n}/{t})',
    '{name}: interruptor activo ({n}/{t})',
    '{name} : interrupteur activé ({n}/{t})',
    '{name}: Schalter an ({n}/{t})',
    '{name}: interruptor ligado ({n}/{t})',
    '{name}: interruttore attivo ({n}/{t})',
    '{name}: स्विच चालू ({n}/{t})',
    '{name}: sakelar aktif ({n}/{t})',
  ],
  'log.switchMiss': [
    '{name}: ハズレのスイッチ',
    '{name}: dummy switch',
    '{name}：假开关',
    '{name}：假開關',
    '{name}: 빗나간 스위치',
    '{name}: interruptor falso',
    '{name} : interrupteur faux',
    '{name}: Blindschalter',
    '{name}: interruptor falso',
    '{name}: interruttore falso',
    '{name}: नकली स्विच',
    '{name}: sakelar palsu',
  ],
  'log.switchTrap': [
    '{name}: 罠スイッチ → 人狼鬼',
    '{name}: trap switch → werewolf',
    '{name}：陷阱开关 → 人狼鬼',
    '{name}：陷阱開關 → 人狼鬼',
    '{name}: 함정 스위치 → 늑대인간',
    '{name}: interruptor trampa → hombre lobo',
    '{name} : interrupteur piège → loup-garou',
    '{name}: Fallenschalter → Werwolf',
    '{name}: interruptor-armadilha → lobisomem',
    '{name}: interruttore trappola → lupo mannaro',
    '{name}: जाल स्विच → वेयरवुल्फ',
    '{name}: sakelar jebakan → manusia serigala',
  ],
  'log.wolfOn': [
    '{name}: 人狼モード',
    '{name}: Wolf Mode',
    '{name}：人狼模式',
    '{name}：人狼模式',
    '{name}: 늑대 모드',
    '{name}: Modo Lobo',
    '{name} : Mode Loup',
    '{name}: Wolf-Modus',
    '{name}: Modo Lobo',
    '{name}: Modalità Lupo',
    '{name}: वुल्फ मोड',
    '{name}: Mode Serigala',
  ],
  'log.wolfOff': [
    '{name}: 人狼モード終了',
    '{name}: Wolf Mode over',
    '{name}：人狼模式结束',
    '{name}：人狼模式結束',
    '{name}: 늑대 모드 종료',
    '{name}: fin del Modo Lobo',
    '{name} : fin du Mode Loup',
    '{name}: Wolf-Modus vorbei',
    '{name}: fim do Modo Lobo',
    '{name}: fine Modalità Lupo',
    '{name}: वुल्फ मोड खत्म',
    '{name}: Mode Serigala selesai',
  ],
  'log.infect': [
    '{name}: 凍った人間を指名',
    '{name}: named a frozen human',
    '{name}：指定了被冻结的人类',
    '{name}：指定了被凍結的人類',
    '{name}: 얼어붙은 인간을 지목',
    '{name}: marcó un congelado',
    '{name} : a marqué un gelé',
    '{name}: markierte einen Eingefrorenen',
    '{name}: marcou um congelado',
    '{name}: ha marcato un congelato',
    '{name}: जमे इंसान को चुना',
    '{name}: menandai manusia beku',
  ],

  /* ---------------- brief / result ---------------- */
  'brief.title': ['役割発表', 'YOUR ROLE', '身份公布', '身份公布', '역할 공개', 'TU PAPEL', 'VOTRE RÔLE', 'DEINE ROLLE', 'SEU PAPEL', 'IL TUO RUOLO', 'तुम्हारी भूमिका', 'PERANMU'],
  'brief.human': ['あなたは人間。仲間を助け、ゲートを開けて逃げろ。', 'You are human. Rescue your team and open a gate.', '你是人类。救助同伴，开门逃出。', '你是人類。救助同伴，開門逃出。', '당신은 인간. 동료를 구하고 게이트를 여세요.', 'Eres humano. Rescata y abre una puerta.', 'Vous êtes humain. Secourez et ouvrez une porte.', 'Du bist Mensch. Rette und öffne ein Tor.', 'Você é humano. Resgate e abra um portão.', 'Sei umano. Salva e apri un cancello.', 'तुम इंसान हो। बचाओ और गेट खोलो।', 'Kau manusia. Selamatkan dan buka gerbang.'],
  'brief.wolf': [
    'あなたは最初の鬼＝マスター鬼。1試合ずっと鬼のまま。凍らせた人間を1人だけ人狼鬼に指名できる。全員凍らせろ。',
    'You are the first wolf — the master wolf — a wolf all match. You may name one frozen human as a werewolf. Freeze them all.',
    '你是最初的鬼＝首领鬼，整场都是鬼。可以把1名被冻结的人类指定为人狼鬼。冻结所有人。',
    '你是最初的鬼＝首領鬼，整場都是鬼。可以把1名被凍結的人類指定為人狼鬼。凍結所有人。',
    '당신은 첫 늑대=마스터 늑대. 경기 내내 늑대입니다. 얼어붙은 인간 한 명을 늑대인간으로 지목할 수 있습니다. 모두 얼리세요.',
    'Eres el primer lobo —el lobo maestro— y lo serás toda la partida. Puedes marcar un humano congelado como hombre lobo. Congélalos a todos.',
    'Vous êtes le premier loup — le loup maître — pour toute la partie. Vous pouvez marquer un humain gelé comme loup-garou. Congelez-les tous.',
    'Du bist der erste Wolf – der Meisterwolf – die ganze Partie. Du darfst einen eingefrorenen Menschen als Werwolf markieren. Friere alle ein.',
    'Você é o primeiro lobo — o lobo mestre — a partida inteira. Pode marcar um humano congelado como lobisomem. Congele todos.',
    'Sei il primo lupo — il lupo maestro — per tutta la partita. Puoi marcare un umano congelato come lupo mannaro. Congela tutti.',
    'तुम पहले भेड़िये — मास्टर भेड़िया — हो, पूरे मैच। एक जमे इंसान को वेयरवुल्फ चुन सकते हो। सबको जमाओ।',
    'Kau serigala pertama — serigala master — sepanjang pertandingan. Kau bisa menandai satu manusia beku sebagai manusia serigala. Bekukan semua.',
  ],
  'brief.werewolf': [
    'あなたは人狼鬼（2人目）。人間に戻ればバレない。変身して凍らせろ。指名はできない。',
    'You are the werewolf (the second wolf). Hide as a human, transform to freeze. You cannot name bait ice.',
    '你是人狼鬼（第二个鬼）。变回人类就不会被发现。变身冻结别人。不能指名。',
    '你是人狼鬼（第二個鬼）。變回人類就不會被發現。變身凍結別人。不能指名。',
    '당신은 늑대인간(두 번째 늑대). 인간으로 숨고 변신해 얼리세요. 지목은 못 합니다.',
    'Eres el hombre lobo (el segundo lobo). Ocúltate y transforma para congelar. No puedes marcar hielo.',
    'Vous êtes le loup-garou (le deuxième loup). Cachez-vous, transformez-vous pour geler. Pas de marquage.',
    'Du bist der Werwolf (der zweite Wolf). Verstecke dich, verwandle dich zum Einfrieren. Kein Markieren.',
    'Você é o lobisomem (o segundo lobo). Esconda-se e transforme para congelar. Não pode marcar gelo.',
    'Sei il lupo mannaro (il secondo lupo). Nasconditi e trasformati per congelare. Non puoi marcare.',
    'तुम वेयरवुल्फ (दूसरा भेड़िया) हो। इंसान बनकर छिपो, बदलकर जमाओ। चुन नहीं सकते।',
    'Kau manusia serigala (serigala kedua). Sembunyi sebagai manusia, berubah untuk membekukan. Tidak bisa menandai.',
  ],
  'brief.ready': ['はじめる', 'START', '开始', '開始', '시작', 'EMPEZAR', 'COMMENCER', 'LOS', 'COMEÇAR', 'INIZIA', 'शुरू', 'MULAI'],
  'brief.countdown': ['{n}', '{n}', '{n}', '{n}', '{n}', '{n}', '{n}', '{n}', '{n}', '{n}', '{n}', '{n}'],
  'brief.go': ['スタート！', 'GO!', '开始！', '開始！', '출발!', '¡YA!', 'PARTEZ !', 'LOS!', 'JÁ!', 'VIA!', 'चलो!', 'MULAI!'],
  'brief.skip': ['タップでスキップ', 'Tap to skip', '点击跳过', '點擊跳過', '탭하여 건너뛰기', 'Toca para saltar', 'Touchez pour passer', 'Tippen zum Überspringen', 'Toque para pular', 'Tocca per saltare', 'छोड़ने के लिए टैप', 'Ketuk untuk lewati'],
  'result.humanWin': ['人間の勝利！', 'HUMANS WIN!', '人类胜利！', '人類勝利！', '인간 승리!', '¡GANAN LOS HUMANOS!', 'LES HUMAINS GAGNENT !', 'MENSCHEN GEWINNEN!', 'HUMANOS VENCEM!', 'VINCONO GLI UMANI!', 'इंसान जीते!', 'MANUSIA MENANG!'],
  'result.wolfWin': ['人狼の勝利！', 'WOLVES WIN!', '人狼胜利！', '人狼勝利！', '늑대 승리!', '¡GANAN LOS LOBOS!', 'LES LOUPS GAGNENT !', 'WÖLFE GEWINNEN!', 'LOBOS VENCEM!', 'VINCONO I LUPI!', 'भेड़िये जीते!', 'SERIGALA MENANG!'],
  'result.byGate': ['ゲートから脱出した', 'Escaped through the gate', '从大门逃出', '從大門逃出', '게이트로 탈출', 'Escaparon por la puerta', 'Évasion par la porte', 'Durch das Tor entkommen', 'Escaparam pelo portão', 'Fuggiti dal cancello', 'गेट से भाग निकले', 'Kabur lewat gerbang'],
  'result.byTime': ['時間切れまで生き残った', 'Survived until time ran out', '坚持到时间结束', '堅持到時間結束', '시간이 끝날 때까지 살아남음', 'Sobrevivieron hasta el final', 'Ont survécu jusqu’au bout', 'Bis zum Ende überlebt', 'Sobreviveram até o fim', 'Sopravvissuti fino alla fine', 'समय तक ज़िंदा रहे', 'Bertahan sampai waktu habis'],
  'result.byFrozen': ['全員凍らせた', 'Everyone was frozen', '冻结了所有人', '凍結了所有人', '모두 얼렸습니다', 'Todos congelados', 'Tous gelés', 'Alle eingefroren', 'Todos congelados', 'Tutti congelati', 'सब जम गए', 'Semua membeku'],
  'result.summary': ['凍結 {f}人・救助 {r}回・スイッチ {s}個', '{f} frozen · {r} rescued · {s} switches', '冻结{f}人・救助{r}次・开关{s}个', '凍結{f}人・救助{r}次・開關{s}個', '얼음 {f}명 · 구출 {r}회 · 스위치 {s}개', '{f} congelados · {r} rescates · {s} interruptores', '{f} gelés · {r} sauvetages · {s} interrupteurs', '{f} eingefroren · {r} gerettet · {s} Schalter', '{f} congelados · {r} resgates · {s} interruptores', '{f} congelati · {r} salvataggi · {s} interruttori', '{f} जमे · {r} बचाए · {s} स्विच', '{f} beku · {r} diselamatkan · {s} sakelar'],
  'result.again': ['もう一度', 'PLAY AGAIN', '再来一局', '再來一局', '다시 하기', 'OTRA VEZ', 'REJOUER', 'NOCHMAL', 'JOGAR DE NOVO', 'RIGIOCA', 'फिर खेलें', 'MAIN LAGI'],
  'result.menu': ['メニューへ', 'MAIN MENU', '返回菜单', '返回選單', '메뉴로', 'AL MENÚ', 'AU MENU', 'ZUM MENÜ', 'AO MENU', 'AL MENU', 'मेन्यू', 'MENU UTAMA'],

  /* ---------------- stamps ---------------- */
  'stamp.help': ['助けて！', 'Help me!', '救命！', '救命！', '도와줘!', '¡Ayuda!', 'À l’aide !', 'Hilfe!', 'Ajuda!', 'Aiuto!', 'मदद!', 'Tolong!'],
  'stamp.wait': ['待って', 'Wait', '等等', '等等', '잠깐', 'Espera', 'Attends', 'Warte', 'Espera', 'Aspetta', 'रुको', 'Tunggu'],
  'stamp.follow': ['ついてきて', 'Follow me', '跟我来', '跟我來', '따라와', 'Sígueme', 'Suis-moi', 'Folge mir', 'Siga-me', 'Seguimi', 'मेरे पीछे', 'Ikuti aku'],
  'stamp.nice': ['ナイス！', 'Nice!', '漂亮！', '漂亮！', '좋아!', '¡Bien!', 'Bien !', 'Super!', 'Boa!', 'Bene!', 'बढ़िया!', 'Bagus!'],
  'stamp.sorry': ['ごめん', 'Sorry', '抱歉', '抱歉', '미안', 'Perdón', 'Désolé', 'Sorry', 'Desculpa', 'Scusa', 'माफ़ करना', 'Maaf'],
  'stamp.gg': ['いい試合！', 'Good game!', '好比赛！', '好比賽！', '좋은 경기!', '¡Buen juego!', 'Bien joué !', 'Gutes Spiel!', 'Bom jogo!', 'Bella partita!', 'अच्छा खेल!', 'Permainan bagus!'],
  'stamp.found': ['見つけた', 'Found you', '找到你了', '找到你了', '찾았다', 'Te encontré', 'Trouvé', 'Gefunden', 'Achei você', 'Trovato', 'मिल गया', 'Ketemu'],
  'stamp.thanks': ['ありがとう', 'Thanks', '谢谢', '謝謝', '고마워', 'Gracias', 'Merci', 'Danke', 'Obrigado', 'Grazie', 'धन्यवाद', 'Terima kasih'],

  /* ---------------- effects banners ---------------- */
  'fx.manta': ['🐟 巨大マンタ通過中', '🐟 A giant manta glides past', '🐟 巨大蝠鲼通过中', '🐟 巨大蝠鱝通過中', '🐟 거대 만타가 지나갑니다', '🐟 Una manta gigante pasa', '🐟 Une manta géante passe', '🐟 Ein riesiger Manta zieht vorbei', '🐟 Uma manta gigante passa', '🐟 Una manta gigante passa', '🐟 विशाल मांता गुज़र रहा है', '🐟 Manta raksasa melintas'],
  'fx.gust': [
    '🌬️ 吹雪の突風！氷が流される',
    '🌬️ Blizzard gust! The ice drifts',
    '🌬️ 暴风雪阵风！冰面会滑动',
    '🌬️ 暴風雪陣風！冰面會滑動',
    '🌬️ 눈보라 돌풍! 얼음이 밀립니다',
    '🌬️ ¡Ráfaga! El hielo se desplaza',
    '🌬️ Rafale ! La glace dérive',
    '🌬️ Böen! Das Eis treibt',
    '🌬️ Rajada! O gelo desliza',
    '🌬️ Raffica! Il ghiaccio scorre',
    '🌬️ बर्फीली हवा! बर्फ खिसकती है',
    '🌬️ Hembusan badai! Es bergeser',
  ],
  'fx.parade': ['🎡 パレード開始！全員スピードUP', '🎡 Parade! Everyone is faster', '🎡 巡游开始！全员加速', '🎡 遊行開始！全員加速', '🎡 퍼레이드 시작! 모두 빨라짐', '🎡 ¡Desfile! Todos más rápidos', '🎡 Parade ! Tout le monde accélère', '🎡 Parade! Alle sind schneller', '🎡 Desfile! Todos mais rápidos', '🎡 Parata! Tutti più veloci', '🎡 परेड! सब तेज़', '🎡 Parade! Semua lebih cepat'],
  'fx.blizzard': ['🌨️ 吹雪！視界が悪い', '🌨️ Blizzard! Visibility drops', '🌨️ 暴风雪！视野变差', '🌨️ 暴風雪！視野變差', '🌨️ 눈보라! 시야가 나빠집니다', '🌨️ ¡Ventisca! Menos visibilidad', '🌨️ Tempête ! Visibilité réduite', '🌨️ Schneesturm! Sicht sinkt', '🌨️ Nevasca! Visibilidade cai', '🌨️ Bufera! Visibilità ridotta', '🌨️ बर्फीला तूफ़ान! दिखना कम', '🌨️ Badai salju! Pandangan turun'],
  'fx.schoolChime': ['🔔 あと{n}秒で教室が閉まる', '🔔 Classroom closes in {n}', '🔔 {n}秒后教室关闭', '🔔 {n}秒後教室關閉', '🔔 {n}초 뒤 교실이 닫힙니다', '🔔 El aula cierra en {n}', '🔔 La classe ferme dans {n}', '🔔 Klasse schließt in {n}', '🔔 A sala fecha em {n}', '🔔 L’aula chiude tra {n}', '🔔 {n} में कक्ष बंद', '🔔 Kelas tutup dalam {n}'],
  'fx.schoolDoors': ['🔒 教室ロック中 あと{n}秒', '🔒 Classroom locked ({n})', '🔒 教室锁定中 剩{n}秒', '🔒 教室鎖定中 剩{n}秒', '🔒 교실 잠김 ({n})', '🔒 Aula cerrada ({n})', '🔒 Classe verrouillée ({n})', '🔒 Klasse verriegelt ({n})', '🔒 Sala trancada ({n})', '🔒 Aula bloccata ({n})', '🔒 कक्ष बंद ({n})', '🔒 Kelas terkunci ({n})'],
  'fx.gravity': ['⚠️ 高重力マス発生！その上は遅い', '⚠️ High-gravity cells! Slow ground', '⚠️ 高重力格出现！上面会变慢', '⚠️ 高重力格出現！上面會變慢', '⚠️ 고중력 칸 발생! 그 위는 느림', '⚠️ ¡Celdas de alta gravedad!', '⚠️ Cellules de forte gravité !', '⚠️ Hochschwerkraft-Felder!', '⚠️ Células de alta gravidade!', '⚠️ Celle di alta gravità!', '⚠️ उच्च गुरुत्व खाने!', '⚠️ Sel gravitasi tinggi!'],

  /* ---------------- misc ---------------- */
  'privacy.title': ['プライバシーポリシー', 'Privacy policy', '隐私政策', '隱私政策', '개인정보 처리방침', 'Privacidad', 'Confidentialité', 'Datenschutz', 'Privacidade', 'Privacy', 'गोपनीयता', 'Privasi'],
  'privacy.body': [
    'ICE WOLF はアカウントを作りません。端末に保存するのは設定・戦績・表示名だけです。オンライン対戦では合言葉・表示名・対戦イベントを Supabase に送ります。位置情報・連絡先・Apple ID は取得しません。',
    'ICE WOLF has no accounts. Settings, records and a display name stay on your device. Online matches send a room code, display name and match events to Supabase. No location, contacts or Apple ID is collected.',
    'ICE WOLF 不创建账号。设置、战绩和显示名只保存在本机。在线对战时会把口令、显示名和对战事件发送到 Supabase。不收集位置、联系人和 Apple ID。',
    'ICE WOLF 不建立帳號。設定、戰績和顯示名只存在本機。線上對戰會把口令、顯示名和對戰事件送到 Supabase。不收集位置、聯絡人和 Apple ID。',
    'ICE WOLF는 계정을 만들지 않습니다. 설정·전적·표시 이름은 기기에만 저장됩니다. 온라인 대전은 방 코드·표시 이름·대전 이벤트를 Supabase로 보냅니다. 위치·연락처·Apple ID는 수집하지 않습니다.',
    'ICE WOLF no crea cuentas. Ajustes, récords y nombre se quedan en tu dispositivo. Las partidas en línea envían código, nombre y eventos a Supabase. No se recogen ubicación, contactos ni Apple ID.',
    'ICE WOLF ne crée pas de compte. Réglages, statistiques et nom restent sur l’appareil. Les parties en ligne envoient code, nom et événements à Supabase. Aucune position, contact ni identifiant Apple n’est collecté.',
    'ICE WOLF legt keine Konten an. Einstellungen, Rekorde und Name bleiben auf dem Gerät. Online-Partien senden Code, Name und Ereignisse an Supabase. Standort, Kontakte und Apple-ID werden nicht erfasst.',
    'O ICE WOLF não cria contas. Ajustes, recordes e nome ficam no aparelho. Partidas online enviam código, nome e eventos ao Supabase. Não coletamos localização, contatos nem Apple ID.',
    'ICE WOLF non crea account. Impostazioni, record e nome restano sul dispositivo. Le partite online inviano codice, nome ed eventi a Supabase. Nessuna posizione, contatto o Apple ID.',
    'ICE WOLF खाता नहीं बनाता। सेटिंग्स, रिकॉर्ड और नाम डिवाइस पर रहते हैं। ऑनलाइन मैच कोड, नाम और घटनाएँ Supabase को भेजते हैं। स्थान, संपर्क या Apple ID नहीं लिया जाता।',
    'ICE WOLF tidak membuat akun. Pengaturan, rekor, dan nama tetap di perangkat. Pertandingan daring mengirim kode, nama, dan peristiwa ke Supabase. Lokasi, kontak, dan Apple ID tidak diambil.',
  ],
  'record.title': ['戦績', 'RECORD', '战绩', '戰績', '전적', 'RÉCORDS', 'STATS', 'REKORD', 'RECORDE', 'RECORD', 'रिकॉर्ड', 'REKOR'],
  'record.games': ['試合数', 'Games', '场次', '場次', '경기', 'Partidas', 'Parties', 'Spiele', 'Partidas', 'Partite', 'मैच', 'Main'],
  'record.humanWins': ['人間の勝ち', 'Human wins', '人类胜', '人類勝', '인간 승', 'Gana humano', 'Victoires humain', 'Menschen siegen', 'Vitórias humano', 'Vittorie umani', 'इंसान जीते', 'Manusia menang'],
  'record.wolfWins': ['人狼の勝ち', 'Wolf wins', '人狼胜', '人狼勝', '늑대 승', 'Gana lobo', 'Victoires loup', 'Wölfe siegen', 'Vitórias lobo', 'Vittorie lupi', 'भेड़िये जीते', 'Serigala menang'],
  'record.rate': ['人間の勝率 {p}%', 'Human win rate {p}%', '人类胜率 {p}%', '人類勝率 {p}%', '인간 승률 {p}%', 'Victorias humanas {p}%', 'Victoires humaines {p} %', 'Menschen-Siege {p} %', 'Vitórias humanas {p}%', 'Vittorie umane {p}%', 'इंसान जीत दर {p}%', 'Rasio menang manusia {p}%'],
  'record.empty': ['まだ試合がありません', 'No matches yet', '还没有比赛', '還沒有比賽', '아직 경기가 없습니다', 'Aún no hay partidas', 'Pas encore de partie', 'Noch keine Partien', 'Ainda sem partidas', 'Nessuna partita', 'अभी कोई मैच नहीं', 'Belum ada pertandingan'],
};

const cache = new Map();

/** Map one BCP-47 tag to one of our twelve. */
function languageFor(tag) {
  const value = String(tag || '');
  if (/^ja/i.test(value)) return 'ja';
  if (/^zh-(tw|hk|hant)/i.test(value)) return 'zh-Hant';
  if (/^zh/i.test(value)) return 'zh-Hans';
  if (/^ko/i.test(value)) return 'ko';
  if (/^es/i.test(value)) return 'es';
  if (/^fr/i.test(value)) return 'fr';
  if (/^de/i.test(value)) return 'de';
  if (/^pt/i.test(value)) return 'pt';
  if (/^it/i.test(value)) return 'it';
  if (/^hi/i.test(value)) return 'hi';
  if (/^id/i.test(value)) return 'id';
  if (/^en/i.test(value)) return 'en';
  return null;
}

/** True when the player actually picked a language in the settings sheet. */
function choiceWasMade() {
  try {
    return localStorage.getItem(STORAGE.languageChosen) === '1';
  } catch {
    return false;
  }
}

/** True when the device clock is set to Japan. */
function inJapan() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Tokyo';
  } catch {
    return false;
  }
}

/** Every locale tag the web view is willing to report. */
function deviceTags() {
  const tags = [];
  try {
    if (Array.isArray(navigator.languages)) tags.push(...navigator.languages);
    if (navigator.language) tags.push(navigator.language);
    if (navigator.userLanguage) tags.push(navigator.userLanguage);
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale) tags.push(locale);
  } catch {
    /* very old web view */
  }
  return tags.filter(Boolean);
}

/**
 * Does the device itself claim Japanese? A WKWebView with no matching
 * localisation reports "en-US" for every phone, so the clock and the Intl
 * locale are checked too: a phone in Japan that only claims English is that
 * case, not an English phone in Japan.
 */
function deviceIsJapanese() {
  const tags = deviceTags();
  return tags.some((tag) => languageFor(tag) === 'ja') || inJapan();
}

/**
 * Build 38 launch fix.
 *
 * The Build 36 fix was right about navigator.languages but left one hole: the
 * app also *saved* the language it picked, and loadSettings only called
 * i18n.init() when nothing was saved. An "en" saved by an earlier build (when
 * the web view still lied) therefore pinned the app to English forever, and
 * i18n.lang stayed null so every string fell back to English as well. Now the
 * saved value only wins when the player chose it in the settings sheet;
 * otherwise the device is asked again on every launch.
 */
function detect(preferred) {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE.language);
  } catch {
    saved = null;
  }
  if (choiceWasMade() && saved && LANG_ORDER.includes(saved)) return saved;
  for (const tag of deviceTags()) {
    const lang = languageFor(tag);
    if (lang && lang !== 'en') return lang;
  }
  if (deviceIsJapanese()) return 'ja';
  if (saved && LANG_ORDER.includes(saved) && saved !== 'en') return saved;
  if (preferred && LANG_ORDER.includes(preferred) && preferred !== 'en') return preferred;
  return 'en';
}

export const i18n = {
  lang: null,
  init(preferred) {
    this.lang = detect(preferred);
    try {
      localStorage.setItem(STORAGE.language, this.lang);
    } catch {
      /* private mode */
    }
    return this.lang;
  },
  set(lang) {
    if (!LANG_ORDER.includes(lang)) return this.lang;
    this.lang = lang;
    try {
      localStorage.setItem(STORAGE.language, lang);
      // From here on this is the player's own choice, and the one detect()
      // keeps on the next launch.
      localStorage.setItem(STORAGE.languageChosen, '1');
    } catch {
      /* private mode */
    }
    return lang;
  },
  t(key, params) {
    const row = T[key];
    if (!row) return key;
    const idx = Math.max(0, LANG_ORDER.indexOf(this.lang || 'en'));
    let s = row[idx] || row[1] || row[0] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  },
  has(key) {
    return Object.prototype.hasOwnProperty.call(T, key);
  },
  keys() {
    return Object.keys(T);
  },
  table() {
    return T;
  },
};

export function t(key, params) {
  return i18n.t(key, params);
}

export function languageName(lang) {
  const names = {
    ja: '日本語',
    en: 'English',
    'zh-Hans': '简体中文',
    'zh-Hant': '繁體中文',
    ko: '한국어',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    pt: 'Português',
    it: 'Italiano',
    hi: 'हिन्दी',
    id: 'Bahasa Indonesia',
  };
  return names[lang] || lang;
}

export function detectLanguage() {
  return detect();
}

export const STAMP_IDS = ['help', 'wait', 'follow', 'nice', 'sorry', 'gg', 'found', 'thanks'];

export function stampText(id, lang) {
  const row = T[`stamp.${id}`];
  if (!row) return id;
  const idx = Math.max(0, LANG_ORDER.indexOf(lang || 'en'));
  return row[idx] || row[1];
}

export const TEXTS = T;
export { cache };
