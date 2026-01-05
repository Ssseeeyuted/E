import { Component, ElementRef, ViewChild, signal, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// --- 進階遊戲設定 ---
const CONFIG = {
    walkSpeed: 2.3,
    runSpeed: 5.0,
    crouchSpeed: 1.2,
    staminaMax: 100,
    staminaDrain: 25, 
    staminaRegen: 8,
    healthMax: 100,
    batteryDrainRate: 0.04, 
    sanityDrainDarkness: 1.2,
    sanityDrainGhostNearby: 6.0,
    sanityRegenLight: 0.8,
    interactDist: 2.5,
    maxSegments: 12, 
    floorHeight: 4,
    corridorWidth: 6,
    ghostSpawnChance: 0.4 
};

// --- 類型定義 ---
type GhostType = 'SHADOW' | 'CRAWLER' | 'MANNEQUIN' | 'SCREAMER' | 'PHANTOM';
type GameState = 'BOOT' | 'PLAYING' | 'PUZZLE' | 'HACKING' | 'READING' | 'HIDING' | 'ELEVATOR_RIDE' | 'DEAD' | 'PAUSED';
type ItemType = 'BATTERY' | 'KEY' | 'BANDAGE' | 'PILLS';

interface Ghost {
    id: number;
    type: GhostType;
    mesh: THREE.Group | THREE.Mesh;
    active: boolean;
    state: 'IDLE' | 'CHASING' | 'WANDERING' | 'SCREAMING' | 'FROZEN';
    speed: number;
    lastSeenTime: number;
    data?: any;
}

interface PropData {
    geo: THREE.BufferGeometry;
    mat: THREE.Material;
    name: string;
    description?: string[];
}

// --- 龐大的敘事資料庫 ---
const FLAVOR_TEXTS = {
    walls: [
        "牆上滿是抓痕，像是有人拚命想爬上去。", "這面牆摸起來...是溫熱的。", "牆壁滲出了黑色的液體，聞起來像鐵鏽。",
        "有人用指甲在牆上刻了無數個『正』字。", "牆紙剝落的地方，露出了裡面發霉的磚頭。", "牆壁裡傳來了微弱的敲擊聲。",
        "這行字是用血寫的：『它在看著你』。", "牆上的塗鴉寫著每個老師的名字，都被打上了紅叉。", "這裡的油漆剝落成了人臉的形狀。",
        "牆壁在呼吸...我一定是瘋了。", "別貼著牆走，裡面有東西。", "這面牆是新砌的，裡面藏了什麼？"
    ],
    floor: [
        "地板黏黏的，每一步都會發出噁心的聲音。", "地上有一長條拖曳的血跡，延伸到黑暗中。", "小心地上的碎玻璃，那是燒杯的碎片。",
        "地板上散落著幾顆牙齒。", "這裡有一隻鞋子，另一隻在哪裡？", "地上畫著奇怪的粉筆圖案，像是某種儀式。",
        "地板的縫隙裡長出了黑色的頭髮。", "不要踩到那個...看起來像眼球的東西。", "地上的水坑映照出的不是我的倒影。"
    ],
    ceiling: [
        "天花板的通風口被暴力扯開了。", "燈管在搖晃，但這裡沒有風。", "上面掛著什麼東西...晃來晃去。",
        "天花板上有濕透的腳印。", "別抬頭，它會發現你看到了它。", "滴答...滴答...是什麼在滴水？"
    ],
    objects: [
        "這看起來已經壞很久了。", "上面沾滿了灰塵和...是乾掉的血嗎？", "是誰把它留在那裡的？",
        "這種老式課桌椅，現在已經沒人用了。", "這東西...感覺很不祥。", "上面刻著『救命』兩個字。"
    ]
};

const MONOLOGUES = {
    idle: [
        "這裡安靜得讓人耳鳴...", "空氣中瀰漫著鐵鏽和發霉的味道。", "我感覺有視線一直在背後...",
        "這所學校以前有這麼大嗎？", "牆壁裡的管線聲音聽起來像是低語。", "我不能停下來，停下來就會死。",
        "手電筒的光越來越暗了...", "為什麼只有我一個人在這裡？", "地板上的污漬...看起來像人臉。",
        "記得呼吸...記得呼吸...", "我好像來過這裡...在夢裡。", "那是哭聲嗎？還是風聲？",
        "我好想回家...媽媽...", "這裡的時間是不流動的。", "我的影子剛才是不是自己動了？",
        "我聽見了廣播聲，但在播放雜訊。", "那是什麼味道？福馬林？", "我的手在發抖。"
    ],
    scary: [
        "那是什麼聲音？！", "別過來...拜託別過來...", "我聽到了腳步聲，不只一個。",
        "它在牆壁裡面移動...", "天花板上有東西滴下來了。", "燈光在閃爍...它靠近了。",
        "我的心跳好快...", "我不該回頭的。", "它看見我了！它看見我了！", "那是誰的臉？！",
        "門...門自己打開了。", "笑聲...那是孩子的笑聲..."
    ],
    hurt: [
        "嘶...好痛...", "我在流血...", "視線開始模糊了...", "我撐不下去了嗎...", "傷口在燃燒..."
    ]
};

const LORE_NOTES = [
    "【校長日誌 1998/9/21】\n地下室的封鎖工程失敗了。那個『東西』並不遵循物理法則。水泥牆擋不住它們的哭聲。我決定把電梯鎖定，並把密碼分散在各個教室的黑板上。",
    "【皺巴巴的考卷】\n姓名：陳小明\n分數：0分\n(背面寫著潦草的字跡)：老師不是老師了。它的臉裂開了，裡面是紅色的光。我躲在櫃子裡，它就在外面敲門...一下、兩下、三下...",
    "【保健室通知單】\n最近因『集體幻覺』來保健室的學生激增。症狀包括：畏光、囈語、聲稱看到影子在走路。建議全校停課檢查空調系統。",
    "【撕碎的日記 - 頁一】\n我們不該玩那個遊戲的。就在B2的走廊盡頭。小華第一個消失，然後是阿強。他們消失的時候，牆壁上的畫好像在笑。",
    "【工友的維修單】\n故障地點：所有教室。\n狀況：門鎖全部失效。無論怎麼換鎖，第二天門都會自動打開。而且門把上有抓痕，是從裡面抓的。",
    "【神秘的警告】\n如果你看到這張紙條，代表你已經在『裡面』了。記住五件事：\n1.紅影跑得快。\n2.天花板的不喜歡光。\n3.雕像看著它的時候不會動。\n4.尖叫的那個會讓我不舒服。\n5.綠色的那個會穿牆。\n祝你好運。",
    "【實驗記錄 Omega】\n對象反應劇烈。它似乎對人類的恐懼有強烈的感應。恐懼越強，實體化越完整。不要害怕...說得容易。",
    "【圖書管理員的便條】\n那些書...半夜會自己掉下來。而且打開來看，裡面的字都變成了『死』字。我辭職了，這地方不對勁。",
    "【營養午餐菜單】\n今日菜色：紅燒肉（肉源不明）、青菜（枯萎）、湯（紅色）。備註：廚房昨晚傳來了尖叫聲，今天肉特別多。",
    "【廣播室留存錄音帶】\n(雜訊)...不要去頂樓...火...都是火...(雜訊)...它們是從鏡子裡出來的...(雜訊)...救命..."
];

const MATH_PUZZLES = [
    { q: "甲乙跑 100m 賽跑，甲需 10 秒，乙需 12.5 秒。當甲到達終點時，乙距離終點還有幾公尺？", a: "20", hint: "乙的速度是 8m/s" },
    { q: "一個正方體的表面積是 150 平方公分，請問它的體積是多少立方公分？", a: "125", hint: "先算邊長。150除以6等於25..." },
    { q: "時鐘在 3 點 30 分的時候，時針和分針的夾角是多少度？", a: "75", hint: "一格是30度，時針走了一半" },
    { q: "數列找規律：1, 4, 9, 16, 25, ?", a: "36", hint: "完全平方數" },
    { q: "雞兔同籠，共有 10 個頭，28 隻腳。請問兔子有幾隻？", a: "4", hint: "假設全是雞(20腳)，多了8隻腳" },
    { q: "某數除以 3 餘 2，除以 5 餘 2，除以 7 餘 2。請問某數最小是多少？", a: "107", hint: "最小公倍數 + 2" },
    { q: "爸爸今年 40 歲，兒子 10 歲。請問幾年後，爸爸的年齡是兒子的 3 倍？", a: "5", hint: "設 x 年後" },
    { q: "一個長 10cm、寬 8cm、高 5cm 的長方體，表面積是多少？", a: "340", hint: "(長x寬 + 寬x高 + 高x長) x 2" },
    { q: "小明有 50 元，買筆花了 1/5，買本子花了剩下的 1/4。還剩多少錢？", a: "30", hint: "剩下40元，再花10元" },
    { q: "邏輯題：英文單字 'LEVEL' 倒過來寫是什麼？", a: "LEVEL", hint: "迴文" },
    { q: "1+2+3+...+100 = ?", a: "5050", hint: "梯形公式 (上底+下底)*高/2" },
    { q: "三個連續奇數的和是 27，最大的數是多少？", a: "11", hint: "中間數是9" },
    { q: "正方形邊長增加 20%，面積增加百分之幾？", a: "44", hint: "1.2 * 1.2 = 1.44" },
    { q: "一根繩子折三折後從中間剪斷，共有幾段？", a: "4", hint: "畫圖看看" }
];

const HACK_CHALLENGES = [
    { 
        title: "ELEVATOR_PWR_CTRL",
        code: "int power = 0;\nfor(int i=0; i<5; i++) {\n  power += 20;\n  if(i == 3) power -= 10;\n}\nprint(power);", 
        options: ["90", "100", "80", "50"], 
        ans: "90",
        desc: "計算最終電力輸出值"
    },
    { 
        title: "SECURITY_DOOR_V2",
        code: "boolean isLocked = true;\nint keyCard = 5;\n\nif (keyCard > 3 && keyCard < 8) {\n  isLocked = !isLocked;\n}\nprint(isLocked);", 
        options: ["true", "false", "undefined", "error"], 
        ans: "false",
        desc: "判斷門鎖狀態 (true/false)"
    },
    { 
        title: "CAMERA_ARRAY_LOOP",
        code: "int[] cams = {1, 0, 1, 1};\nint active = 0;\n\nfor(int c : cams) {\n  if(c == 1) active++;\n}\nprint(active);", 
        options: ["3", "4", "1", "0"], 
        ans: "3",
        desc: "計算運作中的攝影機數量"
    },
    { 
        title: "SYSTEM_DATE_CHECK",
        code: "int year = 1999;\nif (year % 4 == 0) {\n  print('LEAP');\n} else {\n  print('NORMAL');\n}", 
        options: ["LEAP", "NORMAL", "ERROR", "1999"], 
        ans: "NORMAL",
        desc: "判斷閏年邏輯 (1999除以4餘3)"
    },
    {
        title: "FIREWALL_BYPASS",
        code: "int security = 100;\nwhile(security > 0) {\n  security -= 25;\n  if(security == 50) break;\n}\nprint(security);",
        options: ["50", "0", "25", "100"],
        ans: "50",
        desc: "計算迴圈中斷後的安全值"
    }
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
})
export class AppComponent {
  @ViewChild('renderContainer') renderContainer!: ElementRef<HTMLDivElement>;
  
  // -- 遊戲狀態 --
  gameState = signal<GameState>('BOOT');
  
  // HUD 數值
  stamina = signal(100);
  sanity = signal(100);
  health = signal(100); 
  battery = signal(100);
  floor = signal(1);
  puzzlesSolved = signal(0);
  inventory = signal<string[]>([]);
  statusEffects = signal<string[]>([]); 
  
  // UI 互動
  showInteract = signal(false);
  interactText = signal('');
  currentMonologue = signal<string>('');
  
  // 遊戲內活動數據
  currentPuzzle = signal<any>(null);
  puzzleInput = signal('');
  puzzleMsg = signal('');
  
  currentNote = signal(''); 
  
  currentHack = signal<any>(null);
  hackMsg = signal('');
  
  notifications = signal<string[]>([]);

  // Mobile Detection
  isMobile = signal(false);
  
  // Touch Tracking
  moveTouchId: number | null = null;
  moveOrigin = new THREE.Vector2();
  moveCurrent = new THREE.Vector2();
  
  lookTouchId: number | null = null;
  lookLast = new THREE.Vector2();
  
  // Joystick UI Data
  joystickData = signal<{active: boolean, dx: number, dy: number}>({active: false, dx: 0, dy: 0});

  // Three.js 引擎
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: PointerLockControls;
  private flashlight!: THREE.SpotLight;
  private clock = new THREE.Clock();
  
  // 音效
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // 遊戲世界
  private mapSegments: any[] = [];
  private wallMeshes: THREE.Object3D[] = []; 
  private interactables: any[] = [];
  private doors: any[] = []; 
  private activeGhosts: Ghost[] = [];
  
  // 玩家控制
  private input = { fwd: 0, right: 0 };
  private velocity = new THREE.Vector3();
  private isRunning = false;
  private isCrouching = false;
  private flashlightOn = true;
  
  // 生成邏輯
  private genPos = new THREE.Vector3(0, 0, 0);
  private interactionCooldown = 0;
  private lastPosBeforeHide = new THREE.Vector3();
  private entityIdCounter = 0;
  
  // 資產庫
  private assets: { [key: string]: PropData } = {};

  // 系統變數
  private sanityEventTimer = 0;
  private nextSanityEventTime = 10;
  private bleedTimer = 0;

  constructor() {
    // 簡單的手機偵測
    const ua = navigator.userAgent;
    this.isMobile.set(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua));
    
    afterNextRender(() => {
      this.initThreeJS();
    });
  }

  // --- 初始化 ---

  private initThreeJS() {
    if (this.renderer) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010101);
    this.scene.fog = new THREE.FogExp2(0x010101, 0.12);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
    this.camera.position.set(0, 1.7, 0);
    // 確保旋轉順序適合 FPS (先 Yaw 再 Pitch)
    this.camera.rotation.order = 'YXZ'; 

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = false; 
    this.renderContainer.nativeElement.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0x050505);
    this.scene.add(ambient);

    this.flashlight = new THREE.SpotLight(0xffffe0, 2.5, 35, 0.5, 0.5, 1);
    this.flashlight.position.set(0, 0, 0);
    this.camera.add(this.flashlight);
    const target = new THREE.Object3D();
    target.position.set(0, 0, -1);
    this.camera.add(target);
    this.flashlight.target = target;
    this.scene.add(this.camera);

    if (!this.isMobile()) {
        this.controls = new PointerLockControls(this.camera, document.body);
        this.controls.addEventListener('unlock', () => {
             if (this.gameState() === 'PLAYING') {
                 this.gameState.set('PAUSED');
             }
        });
    } else {
        this.setupTouchControls();
    }

    this.generatePropAssets();

    this.spawnNextSegment(true);
    this.spawnNextSegment(true);
    this.spawnNextSegment();

    this.addTutorialNote();

    window.addEventListener('resize', () => this.onWindowResize());
    this.setupInputs();

    this.animate();
  }

  // --- 手機觸控控制 ---
  private setupTouchControls() {
      const el = this.renderContainer.nativeElement;
      
      // 禁止長按選單
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); return false; });
      
      el.addEventListener('touchstart', (e) => {
          if (this.gameState() !== 'PLAYING') return;
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
              const t = e.changedTouches[i];
              const x = t.clientX;
              const y = t.clientY;
              
              // 左半邊螢幕：移動搖桿
              if (x < window.innerWidth / 2) {
                  if (this.moveTouchId === null) {
                      this.moveTouchId = t.identifier;
                      this.moveOrigin.set(x, y);
                      this.moveCurrent.set(x, y);
                      this.joystickData.set({active: true, dx: 0, dy: 0});
                  }
              } 
              // 右半邊螢幕：轉視角 (避開右下角按鈕區，假設按鈕區在 bottom 150px, right 150px)
              else {
                  if (this.lookTouchId === null) {
                      // 簡單避開按鈕區判斷
                      if (y < window.innerHeight - 150 || x < window.innerWidth - 150) {
                          this.lookTouchId = t.identifier;
                          this.lookLast.set(x, y);
                      }
                  }
              }
          }
      }, { passive: false });

      el.addEventListener('touchmove', (e) => {
          if (this.gameState() !== 'PLAYING') return;
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
              const t = e.changedTouches[i];
              
              if (t.identifier === this.moveTouchId) {
                  this.moveCurrent.set(t.clientX, t.clientY);
                  this.updateJoystick();
              } else if (t.identifier === this.lookTouchId) {
                  const dx = t.clientX - this.lookLast.x;
                  const dy = t.clientY - this.lookLast.y;
                  
                  // 轉動視角
                  const sensitivity = 0.005;
                  this.camera.rotation.y -= dx * sensitivity;
                  this.camera.rotation.x -= dy * sensitivity;
                  
                  // 限制俯仰角
                  const maxPolar = Math.PI / 2 - 0.1;
                  this.camera.rotation.x = Math.max(-maxPolar, Math.min(maxPolar, this.camera.rotation.x));
                  
                  this.lookLast.set(t.clientX, t.clientY);
              }
          }
      }, { passive: false });

      el.addEventListener('touchend', (e) => {
          e.preventDefault();
          for (let i = 0; i < e.changedTouches.length; i++) {
              const t = e.changedTouches[i];
              if (t.identifier === this.moveTouchId) {
                  this.moveTouchId = null;
                  this.input.fwd = 0;
                  this.input.right = 0;
                  this.joystickData.set({active: false, dx: 0, dy: 0});
              } else if (t.identifier === this.lookTouchId) {
                  this.lookTouchId = null;
              }
          }
      });
  }

  private updateJoystick() {
      const maxRadius = 60;
      let dx = this.moveCurrent.x - this.moveOrigin.x;
      let dy = this.moveCurrent.y - this.moveOrigin.y;
      
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > maxRadius) {
          const ratio = maxRadius / dist;
          dx *= ratio;
          dy *= ratio;
      }
      
      this.input.right = dx / maxRadius;
      this.input.fwd = -(dy / maxRadius); // 上滑是負Y，對應前進+1
      
      this.joystickData.set({active: true, dx, dy});
  }
  
  // 手機按鈕動作
  mobileAction(action: string) {
      if (action === 'interact') {
          this.inputInteraction = true; 
          setTimeout(()=>this.inputInteraction=false, 100);
      } else if (action === 'flashlight') {
          this.flashlightOn = !this.flashlightOn;
          this.playSound('click');
      } else if (action === 'crouch') {
          this.isCrouching = !this.isCrouching;
      } else if (action === 'run') {
          this.isRunning = !this.isRunning;
      } else if (action === 'pause') {
          this.togglePause();
      }
  }

  private onWindowResize() {
      if (this.camera && this.renderer) {
          this.camera.aspect = window.innerWidth / window.innerHeight;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
  }

  private safeLock() {
      // 手機模式下不使用 pointer lock
      if (this.isMobile()) return;
      
      if (this.controls && !this.controls.isLocked) {
          try {
              this.controls.lock();
          } catch (e) {
              console.warn("Pointer lock request failed", e);
          }
      }
  }

  // --- 遊戲迴圈 ---

  private animate = () => {
    requestAnimationFrame(this.animate);
    
    if (this.gameState() === 'PAUSED') return; 

    const dt = this.clock.getDelta();
    const now = this.clock.getElapsedTime();

    if (this.gameState() === 'PLAYING') {
        this.updatePlayer(dt, now);
        this.updateWorld(dt);
        this.updateEntities(dt);
        this.updateDoors(dt);
        this.updateSanityEffects(now, dt);
        this.updateStatusEffects(dt);
    } 
    else if (this.gameState() === 'HIDING') {
        this.updateHiding(dt, now);
        this.updateWorld(dt);
        this.updateEntities(dt);
        this.stamina.update(s => Math.min(100, s + 8 * dt));
        this.sanity.update(s => Math.min(100, s + 1 * dt));
        this.updateStatusEffects(dt);
    }
    else if (this.gameState() === 'ELEVATOR_RIDE') {
        this.camera.position.y = 1.7 + Math.sin(now * 50) * 0.05;
    }

    if (this.flashlightOn && this.battery() > 0 && this.gameState() !== 'HIDING') {
         this.battery.update(b => Math.max(0, b - CONFIG.batteryDrainRate * dt));
         
         const flickerThreshold = this.battery() < 20 ? 0.9 : (this.sanity() < 40 ? 0.95 : 0.99);
         const noise = Math.random();
         this.flashlight.intensity = noise > flickerThreshold ? 0.1 : 2.8;
         
         if (this.battery() <= 0) {
             this.flashlightOn = false;
             this.showToast("手電筒沒電了！");
             this.playSound('click');
         }
    } else {
        this.flashlight.intensity = 0;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // --- 玩家與世界更新 ---

  private updatePlayer(dt: number, time: number) {
    let currentStamina = this.stamina();
    if (!this.isRunning && currentStamina < CONFIG.staminaMax) currentStamina += CONFIG.staminaRegen * dt;
    
    let speed = CONFIG.walkSpeed;
    if (this.isCrouching) speed = CONFIG.crouchSpeed;
    else if (this.isRunning && currentStamina > 0) { 
        speed = CONFIG.runSpeed; 
        currentStamina -= CONFIG.staminaDrain * dt; 
    }
    this.stamina.set(Math.max(0, Math.min(100, currentStamina)));

    let sanityDrain = 0;
    if (!this.flashlightOn) sanityDrain += CONFIG.sanityDrainDarkness;
    const nearbyGhost = this.activeGhosts.some(g => g.active && g.mesh.position.distanceTo(this.camera.position) < 8);
    if (nearbyGhost) sanityDrain += CONFIG.sanityDrainGhostNearby;
    
    if (!nearbyGhost && this.flashlightOn) {
        this.sanity.update(s => Math.min(100, s + CONFIG.sanityRegenLight * dt));
    } else {
        this.sanity.update(s => Math.max(0, s - sanityDrain * dt));
    }

    const dir = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd); 
    fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    dir.addScaledVector(fwd, this.input.fwd).addScaledVector(right, this.input.right);

    if (dir.lengthSq() > 0) {
        dir.normalize();
        const ray = new THREE.Raycaster(this.camera.position, dir, 0, 0.6);
        const hits = ray.intersectObjects(this.wallMeshes);
        if (hits.length === 0) {
            this.velocity.x = dir.x * speed; 
            this.velocity.z = dir.z * speed;
        } else {
            this.velocity.set(0,0,0);
        }
    } else {
        this.velocity.set(0,0,0);
    }
    this.camera.position.addScaledVector(this.velocity, dt);
    
    if (this.velocity.lengthSq() > 0.1) {
        const bobFreq = this.isRunning ? 14 : 7; 
        const bobAmp = 0.035;
        this.camera.position.y = (this.isCrouching ? 0.9 : 1.7) + Math.sin(time * bobFreq) * bobAmp;
    } else {
        this.camera.position.y += ((this.isCrouching ? 0.9 : 1.7) - this.camera.position.y) * 8 * dt;
    }
    if (this.camera.position.y < 0.5) this.camera.position.y = 0.5;

    if (this.interactionCooldown > 0) this.interactionCooldown -= dt;
    this.checkInteractions();
  }

  private updateStatusEffects(dt: number) {
      if (this.statusEffects().includes('BLEEDING')) {
          this.bleedTimer += dt;
          if (this.bleedTimer > 2.0) { 
              this.health.update(h => Math.max(0, h - 2));
              this.showToast("你在流血！");
              this.triggerMonologue(this.getRand(MONOLOGUES.hurt), 1000);
              this.bleedTimer = 0;
              this.camera.position.y -= 0.1; 
          }
      }
      
      if (this.health() <= 0 && this.gameState() !== 'DEAD') {
          this.triggerDeath("失血過多而亡");
      }
  }

  private updateHiding(dt: number, time: number) {
      this.camera.position.y = 1.3 + Math.sin(time * 2.5) * 0.01;
      this.velocity.set(0, 0, 0);
  }
  
  private updateWorld(dt: number) {
      const distToFrontier = this.camera.position.z - this.genPos.z;
      if (distToFrontier < 80) {
          this.spawnNextSegment();
      }
  }

  private updateSanityEffects(time: number, dt: number) {
      if (this.sanity() < 50) {
          this.camera.fov = 70 + Math.sin(time * 2.5) * (50 - this.sanity()) * 0.15;
          this.camera.updateProjectionMatrix();
          
          if (Math.random() < (100 - this.sanity()) * 0.0002) {
              this.camera.rotation.z += (Math.random() - 0.5) * 0.15;
              setTimeout(() => this.camera.rotation.z = 0, 150);
          }
      } else {
          this.camera.fov = 70;
          this.camera.updateProjectionMatrix();
      }

      this.sanityEventTimer += dt;
      if (this.sanityEventTimer > this.nextSanityEventTime) {
          this.triggerSanityEvent();
          this.sanityEventTimer = 0;
          this.nextSanityEventTime = Math.random() * 20 + 10; 
      }
  }

  private triggerSanityEvent() {
      const s = this.sanity();
      if (s > 80) return; 

      const rand = Math.random();
      if (s < 60 && rand < 0.3) {
          this.playSound('breath'); 
          this.showToast("有東西在你耳邊呼吸...");
      } else if (s < 40 && rand < 0.6) {
           this.triggerMonologue("它們就在這裡...我看不到，但我知道。", 3000);
      } else if (s < 20) {
          this.playSound('scream');
          this.camera.rotation.z = 0.2;
          setTimeout(() => this.camera.rotation.z = 0, 200);
          this.showToast("幻覺：尖叫聲");
      }
  }

  private updateDoors(dt: number) {
      this.doors.forEach(d => {
          if (d.pivot) {
              const diff = d.targetRot - d.pivot.rotation.y;
              if (Math.abs(diff) > 0.01) {
                   d.pivot.rotation.y += diff * 5 * dt;
              }
          }
      });
  }

  // --- 鬼魂 AI ---

  private spawnGhost(type: GhostType) {
      if (this.floor() < 2) return; 
      
      const id = ++this.entityIdCounter;
      let mesh: THREE.Group | THREE.Mesh;
      let startPos = new THREE.Vector3();
      const back = new THREE.Vector3(); 
      this.camera.getWorldDirection(back); back.negate();

      switch(type) {
          case 'SHADOW': 
              mesh = this.createGhostMesh(0xaa0000, 1.8);
              startPos.copy(this.camera.position).addScaledVector(back, 18);
              break;
          case 'CRAWLER': 
              mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1.5), new THREE.MeshStandardMaterial({color: 0x221111}));
              startPos.copy(this.camera.position).addScaledVector(back, 20);
              startPos.y = 3.8;
              break;
          case 'MANNEQUIN': 
              mesh = this.createGhostMesh(0xcccccc, 1.7); 
              const fwd = new THREE.Vector3(); this.camera.getWorldDirection(fwd);
              startPos.copy(this.camera.position).addScaledVector(fwd, 25); 
              break;
          case 'SCREAMER':
              mesh = this.createGhostMesh(0x555555, 1.6);
              startPos.copy(this.camera.position).addScaledVector(back, 25);
              break;
          case 'PHANTOM':
              mesh = this.createGhostMesh(0x88ff88, 1.8);
              (mesh.children[1] as THREE.Mesh).material = new THREE.MeshBasicMaterial({color: 0x88ff88, transparent: true, opacity: 0.3});
              startPos.copy(this.camera.position).add(new THREE.Vector3(5, 0, 5));
              break;
          default: return;
      }
      
      mesh.position.copy(startPos);
      this.scene.add(mesh);
      
      const ghost: Ghost = {
          id, type, mesh, active: true, state: 'CHASING', speed: 0, lastSeenTime: 0,
          data: type === 'MANNEQUIN' ? { frozen: false } : {}
      };
      
      if (type === 'SHADOW') { ghost.speed = 3.8; this.triggerMonologue(this.getRand(MONOLOGUES.scary), 2000); }
      if (type === 'CRAWLER') { ghost.speed = 4.5; this.triggerMonologue("天花板上有東西...", 2000); }
      if (type === 'MANNEQUIN') { ghost.speed = 8.0; ghost.state = 'FROZEN'; this.triggerMonologue("那個雕像剛剛動了嗎？", 2000); }
      if (type === 'SCREAMER') { ghost.speed = 2.0; ghost.state = 'WANDERING'; }
      if (type === 'PHANTOM') { ghost.speed = 1.5; }

      this.activeGhosts.push(ghost);
      this.playSound('breath');
  }

  private createGhostMesh(color: number, height: number): THREE.Group {
      const g = new THREE.Group();
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({color}));
      head.position.y = height - 0.2;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, height - 0.6), new THREE.MeshStandardMaterial({color}));
      body.position.y = (height - 0.6) / 2;
      g.add(head); g.add(body);
      return g;
  }

  private updateEntities(dt: number) {
      const playerPos = this.camera.position;
      const camDir = new THREE.Vector3();
      this.camera.getWorldDirection(camDir);

      this.activeGhosts.forEach(g => {
          if (!g.active) return;
          const dist = g.mesh.position.distanceTo(playerPos);
          
          if (dist > 45) {
              g.active = false;
              this.scene.remove(g.mesh as THREE.Object3D);
              return;
          }

          if (this.gameState() === 'HIDING' && dist > 2) return;

          const dirToPlayer = new THREE.Vector3().subVectors(playerPos, g.mesh.position).normalize();
          
          switch(g.type) {
              case 'SHADOW':
                  g.mesh.lookAt(playerPos);
                  g.mesh.position.addScaledVector(dirToPlayer, g.speed * dt);
                  if (dist < 1.5) { this.health.update(h=>h-30); this.applyStatus('BLEEDING'); this.triggerDeath("被紅影抓住了"); }
                  break;

              case 'CRAWLER':
                  if (this.flashlightOn && dist < 15) g.speed = 6.0; 
                  else g.speed = 4.0;
                  g.mesh.lookAt(playerPos);
                  g.mesh.position.addScaledVector(dirToPlayer, g.speed * dt);
                  if (dist < 1.5) this.triggerDeath("天花板的怪物把頭咬掉了");
                  break;

              case 'MANNEQUIN':
                  const dirToGhost = new THREE.Vector3().subVectors(g.mesh.position, playerPos).normalize();
                  const dot = camDir.dot(dirToGhost);
                  const isVisible = dot > 0.5;
                  
                  if (isVisible) {
                      g.data.frozen = true;
                  } else {
                      g.data.frozen = false;
                      g.mesh.lookAt(playerPos);
                      const flatDir = new THREE.Vector3(dirToPlayer.x, 0, dirToPlayer.z).normalize();
                      g.mesh.position.addScaledVector(flatDir, g.speed * dt);
                      if (Math.random() < 0.1) this.playSound('click'); 
                  }
                  if (dist < 1.2) this.triggerDeath("雕像扭斷了你的脖子");
                  break;

              case 'SCREAMER':
                  if (g.state === 'WANDERING') {
                      g.mesh.position.z += g.speed * dt;
                      if (dist < 10 && !this.isCrouching) {
                          g.state = 'SCREAMING';
                          this.playSound('scream');
                          this.sanity.update(s => Math.max(0, s - 40));
                          this.showToast("它發現你了！");
                          this.isRunning = false; 
                      }
                  } else if (g.state === 'SCREAMING') {
                      g.mesh.position.x += (Math.random()-0.5)*0.1;
                      if (dist < 2) this.triggerDeath("你的耳膜破裂導致腦出血");
                  }
                  break;

              case 'PHANTOM':
                  g.mesh.lookAt(playerPos);
                  g.mesh.position.addScaledVector(dirToPlayer, g.speed * dt);
                  if (dist < 1.0) this.triggerDeath("它穿過了你的身體，帶走了靈魂");
                  break;
          }
      });
  }

  // --- 地圖生成 ---

  private generatePropAssets() {
      const matRed = new THREE.MeshStandardMaterial({color: 0xaa2222, roughness: 0.9});
      const matGrey = new THREE.MeshStandardMaterial({color: 0x555555, roughness: 0.7});
      const matWood = new THREE.MeshStandardMaterial({color: 0x5c4033, roughness: 1.0});
      const matPaper = new THREE.MeshBasicMaterial({color: 0xeeeeee});
      const matGlass = new THREE.MeshStandardMaterial({color: 0x88cccc, transparent: true, opacity: 0.4});
      const matBone = new THREE.MeshStandardMaterial({color: 0xe3dac9, roughness: 0.5});
      const matBlack = new THREE.MeshStandardMaterial({color: 0x111111});

      this.assets['bucket'] = { 
          geo: new THREE.CylinderGeometry(0.3, 0.25, 0.4), mat: matGrey, name: '生鏽的水桶',
          description: ["底部已經鏽穿了。", "裡面有乾掉的油漆...還是血？", "踢到的聲音很空洞。"]
      };
      this.assets['chair_broken'] = { 
          geo: new THREE.BoxGeometry(0.5, 0.5, 0.5), mat: matWood, name: '壞掉的椅子',
          description: ["椅背上有抓痕。", "這是一張行刑椅嗎？", "像是被某種巨大的力量從中間折斷。", "坐墊上有奇怪的凹陷。"]
      };
      this.assets['box'] = { 
          geo: new THREE.BoxGeometry(0.6, 0.5, 0.6), mat: matWood, name: '舊紙箱',
          description: ["散發著潮濕霉味的紙箱。", "裡面有些不明生物的乾屍。", "藏著一堆被揉爛的求救信。", "紙箱底部濕濕的，散發著臭味。"]
      };
      this.assets['trash'] = { 
          geo: new THREE.DodecahedronGeometry(0.15), mat: matPaper, name: '垃圾團',
          description: ["是一張揉成團的情書，上面寫滿了『恨』。", "沾滿了黑色黏液的衛生紙。", "打開來看，裡面包著一顆牙齒。"]
      };
      this.assets['cone'] = { 
          geo: new THREE.ConeGeometry(0.2, 0.6, 8), mat: new THREE.MeshStandardMaterial({color: 0xffaa00}), name: '路障',
          description: ["上面寫著『禁止進入』。", "擺在這裡是為了擋住什麼？", "塑膠已經脆化了，一碰就碎。"]
      };
      this.assets['book'] = { 
          geo: new THREE.BoxGeometry(0.3, 0.05, 0.4), mat: matRed, name: '厚重的課本',
          description: ["書頁間夾著令人不安的黑色毛髮。", "文字似乎隨著視線在移動。", "這不是學校該有的教材...全是獻祭儀式。", "每一頁都被紅筆瘋狂地劃掉了。"]
      };
      this.assets['glass'] = { 
          geo: new THREE.TetrahedronGeometry(0.1), mat: matGlass, name: '碎玻璃',
          description: ["小心割手。", "映照出的倒影好像在笑。", "這是窗戶的碎片嗎？還是鏡子？"]
      };
      
      this.assets['medkit_empty'] = { 
          geo: new THREE.BoxGeometry(0.4, 0.2, 0.3), mat: new THREE.MeshStandardMaterial({color: 0xffffff}), name: '空急救箱',
          description: ["裡面空空如也，連棉花都不剩。", "蓋子內側寫著：『救不了，沒人救得了』。", "被洗劫一空了，只有血手印留在把手上。", "這裡面曾經裝著希望，現在只剩下灰塵。"]
      };
      this.assets['pipe_loose'] = { 
          geo: new THREE.CylinderGeometry(0.05, 0.05, 1.2), mat: matGrey, name: '鬆脫的鐵管',
          description: ["沈甸甸的，可以用來防身...可惜拿不起來。", "上面有凹痕，像是打過什麼東西。", "管口塞滿了頭髮。"]
      };
      this.assets['shoe'] = { 
          geo: new THREE.BoxGeometry(0.15, 0.1, 0.3), mat: matBlack, name: '遺落的鞋子',
          description: ["只有左腳。", "尺寸很小，是學生的鞋子。", "鞋帶綁成了死結。", "鞋底沾滿了乾掉的泥土和紅色的東西。"]
      };
      this.assets['skull'] = { 
          geo: new THREE.IcosahedronGeometry(0.2, 1), mat: matBone, name: '頭骨模型(是真的嗎?)',
          description: ["是生物教室的模型吧...希望是。", "摸起來冰冷且粗糙。", "眼窩深處似乎有東西在看著我。", "下顎骨不見了。"]
      };
      this.assets['backpack'] = { 
          geo: new THREE.DodecahedronGeometry(0.3), mat: new THREE.MeshStandardMaterial({color: 0x334455}), name: '學生的書包',
          description: ["拉鍊卡住了，打不開。", "裡面有些發霉的課本和腐爛的便當。", "書包上掛著一個平安符，已經變黑了。", "沈甸甸的，感覺像是裝了石頭。"]
      };
      this.assets['monitor'] = { 
          geo: new THREE.BoxGeometry(0.5, 0.4, 0.1), mat: matGrey, name: '破碎的螢幕',
          description: ["螢幕上燒錄著一張驚恐的臉。", "早就壞了，按鈕都不見了。", "只有雜訊。", "裂痕中心有一個彈孔？"]
      };
      this.assets['bottle'] = { 
          geo: new THREE.CylinderGeometry(0.05, 0.05, 0.25), mat: matGlass, name: '化學藥劑瓶',
          description: ["標籤被撕掉了。", "液體呈現不自然的紫色。", "瓶口有結晶。", "聞起來像杏仁味...氰化物？"]
      };
  }

  private spawnNextSegment(safe = false) {
    const group = new THREE.Group();
    group.position.copy(this.genPos);

    const mFloor = this.getMat('floor');
    const mWall = this.getMat('wall');
    
    const fGeo = new THREE.PlaneGeometry(6, 20);
    const floor = new THREE.Mesh(fGeo, mFloor);
    floor.rotation.x = -Math.PI/2; floor.position.set(0, 0, -10);
    group.add(floor);
    this.interactables.push({mesh: floor, type: 'flavor', hoverText: '查看地板', data: this.getRand(FLAVOR_TEXTS.floor)});

    const ceil = new THREE.Mesh(fGeo, this.getMat('ceiling'));
    ceil.rotation.x = Math.PI/2; ceil.position.set(0, 4, -10);
    group.add(ceil);

    const wGeo = new THREE.PlaneGeometry(20, 4);
    const wR = new THREE.Mesh(wGeo, mWall);
    wR.rotation.y = -Math.PI/2; wR.position.set(3, 2, -10);
    group.add(wR); this.wallMeshes.push(wR);
    this.decorateWall(group, 2.9, -10, -Math.PI/2); 

    const hasClassroom = !safe && Math.random() > 0.4;
    if (hasClassroom) {
        const wL1 = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), mWall);
        wL1.rotation.y = Math.PI/2; wL1.position.set(-3, 2, -4); 
        group.add(wL1); this.wallMeshes.push(wL1);
        
        const wL2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), mWall);
        wL2.rotation.y = Math.PI/2; wL2.position.set(-3, 2, -16); 
        group.add(wL2); this.wallMeshes.push(wL2);
        
        const wTop = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), mWall);
        wTop.rotation.y = Math.PI/2; wTop.position.set(-3, 3.5, -10);
        group.add(wTop); this.wallMeshes.push(wTop);

        this.buildClassroom(group, -10);
    } else {
        const wL = new THREE.Mesh(wGeo, mWall);
        wL.rotation.y = Math.PI/2; wL.position.set(-3, 2, -10);
        group.add(wL); this.wallMeshes.push(wL);
        this.decorateWall(group, -2.9, -10, Math.PI/2);
    }

    this.scatterDebris(group);

    if (!safe && Math.random() > 0.9) this.buildElevator(group, -19);

    if (Math.random() > 0.3) {
        const light = new THREE.PointLight(0x88aa88, 0.6, 12);
        light.position.set(0, 3.8, -10);
        group.add(light);
    }

    this.scene.add(group);
    this.mapSegments.push({ group, walls: this.wallMeshes.slice(this.wallMeshes.length - 12) });
    this.genPos.z -= 20;

    if (this.mapSegments.length > CONFIG.maxSegments) {
        const old = this.mapSegments.shift();
        this.scene.remove(old.group);
    }
    
    if (!safe && this.floor() >= 2) {
        if (Math.random() < CONFIG.ghostSpawnChance) {
            const types: GhostType[] = ['SHADOW', 'CRAWLER', 'MANNEQUIN', 'SCREAMER', 'PHANTOM'];
            this.spawnGhost(types[Math.floor(Math.random() * types.length)]);
        }
    }
  }

  private decorateWall(group: THREE.Group, x: number, zCenter: number, rotY: number) {
      const numProps = Math.floor(Math.random() * 5);
      for(let i=0; i<numProps; i++) {
          const z = zCenter + (Math.random() * 18 - 9);
          const rand = Math.random();
          
          if (rand < 0.15) {
              const m = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6), new THREE.MeshStandardMaterial({color: 0xaa2222}));
              m.position.set(x + (x>0?-0.2:0.2), 1.2, z);
              group.add(m);
              this.interactables.push({mesh:m, type:'flavor', hoverText:'查看滅火器', data:'過期很久了，噴嘴已經生鏽。'});
          } else if (rand < 0.3) {
              const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({color: Math.random() * 0xffffff}));
              p.position.set(x + (x>0?-0.05:0.05), 2.0, z);
              p.rotation.y = rotY;
              group.add(p);
              this.interactables.push({mesh:p, type:'flavor', hoverText:'查看海報', data:'校慶海報...日期是 20 年前。'});
          } else if (rand < 0.4) {
              const v = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1.2), new THREE.MeshStandardMaterial({color: 0x222233}));
              v.position.set(x + (x>0?-0.6:0.6), 1.1, z);
              v.rotation.y = rotY;
              group.add(v); this.wallMeshes.push(v);
              this.interactables.push({mesh:v, type:'flavor', hoverText:'檢查販賣機', data:'裡面只有空罐子，而且按鈕上沾了血。'});
          }
      }
  }

  private scatterDebris(group: THREE.Group) {
      const num = Math.floor(Math.random() * 12); 
      for(let i=0; i<num; i++) {
          const x = (Math.random() * 4) - 2;
          const z = -Math.random() * 20;
          const r = Math.random();
          
          let type = '';
          if (r < 0.05) type = 'bucket';
          else if (r < 0.1) type = 'cone';
          else if (r < 0.15) type = 'trash';
          else if (r < 0.2) type = 'book';
          else if (r < 0.25) type = 'glass';
          else if (r < 0.3) type = 'medkit_empty';
          else if (r < 0.35) type = 'pipe_loose';
          else if (r < 0.4) type = 'shoe';
          else if (r < 0.45) type = 'skull';
          else if (r < 0.5) type = 'backpack';
          else if (r < 0.55) type = 'monitor';
          else if (r < 0.6) type = 'bottle';

          if (type) this.spawnProp(type, x, z, group, '');
          
          else if (r < 0.7) {
              const note = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshBasicMaterial({color: 0xeeeeee}));
              note.rotation.x = -Math.PI/2; note.position.set(x, 0.02, z);
              note.rotation.z = Math.random() * Math.PI;
              group.add(note);
              this.interactables.push({mesh: note, type: 'note', hoverText: '閱讀紙條', data: this.getRand(LORE_NOTES)});
          } else if (r < 0.8) {
              this.spawnItem(x, z, group);
          }
      }
  }

  private spawnProp(key: string, x: number, z: number, group: THREE.Group, desc: string) {
      const data = this.assets[key];
      if (!data) return;
      const m = new THREE.Mesh(data.geo, data.mat);
      m.position.set(x, 0.1, z);
      m.rotation.set(Math.random()*0.5, Math.random()*3, Math.random()*0.5);
      group.add(m);
      
      const flavorText = data.description ? this.getRand(data.description) : this.getRand(FLAVOR_TEXTS.objects);
      this.interactables.push({mesh:m, type:'flavor', hoverText: `查看${data.name}`, data: flavorText});
  }
  
  private spawnItem(x: number, z: number, group: THREE.Group) {
      const r = Math.random();
      let type: ItemType = 'BATTERY';
      let color = 0x00ff00;
      let geo = new THREE.CylinderGeometry(0.1, 0.1, 0.3);
      let text = '撿起電池';

      if (r < 0.4) {
          type = 'BATTERY'; 
          color = 0x00ff00;
          text = '撿起電池';
      } else if (r < 0.6) {
          type = 'BANDAGE'; 
          geo = new THREE.BoxGeometry(0.3, 0.1, 0.3);
          color = 0xffffff;
          text = '撿起繃帶';
      } else if (r < 0.8) {
          type = 'PILLS'; 
          geo = new THREE.CylinderGeometry(0.05, 0.05, 0.15);
          color = 0x0000ff;
          text = '撿起鎮靜劑';
      } else {
          type = 'KEY';
          geo = new THREE.BoxGeometry(0.1, 0.1, 0.3);
          color = 0xffaa00;
          text = '撿起鑰匙';
      }

      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 0.5}));
      mesh.position.set(x, 0.2, z);
      group.add(mesh);
      
      this.interactables.push({
          mesh, 
          type: 'pickup', 
          hoverText: text,
          data: type
      });
  }

  // --- 教室生成 ---
  private buildClassroom(parent: THREE.Group, zCenter: number) {
      const roomGroup = new THREE.Group();
      
      const mFloor = this.getMat('floor_room');
      const mWall = this.getMat('wall_room');
      const mBlackboard = new THREE.MeshStandardMaterial({color: 0x223322, roughness: 0.9});

      const rFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), mFloor);
      rFloor.rotation.x = -Math.PI/2; rFloor.position.set(-8, 0.02, zCenter);
      roomGroup.add(rFloor);
      
      const rCeil = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), this.getMat('ceiling'));
      rCeil.rotation.x = Math.PI/2; rCeil.position.set(-8, 4, zCenter);
      roomGroup.add(rCeil);

      const wBack = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), mWall);
      wBack.rotation.y = Math.PI/2; wBack.position.set(-13, 2, zCenter);
      roomGroup.add(wBack); this.wallMeshes.push(wBack);
      this.interactables.push({mesh: wBack, type: 'flavor', hoverText: '查看牆壁', data: this.getRand(FLAVOR_TEXTS.walls)});

      const wN = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), mWall);
      wN.position.set(-8, 2, zCenter - 6); roomGroup.add(wN); this.wallMeshes.push(wN);

      const wS = new THREE.Mesh(new THREE.PlaneGeometry(10, 4), mWall);
      wS.rotation.y = Math.PI; wS.position.set(-8, 2, zCenter + 6); roomGroup.add(wS); this.wallMeshes.push(wS);
      
      const wIn1 = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), mWall);
      wIn1.rotation.y = -Math.PI/2; wIn1.position.set(-3, 2, zCenter - 5); roomGroup.add(wIn1); this.wallMeshes.push(wIn1);
      
      const wIn2 = new THREE.Mesh(new THREE.PlaneGeometry(2, 4), mWall);
      wIn2.rotation.y = -Math.PI/2; wIn2.position.set(-3, 2, zCenter + 5); roomGroup.add(wIn2); this.wallMeshes.push(wIn2);

      const doorPivot = new THREE.Group();
      doorPivot.position.set(-3, 0, zCenter - 4); 
      
      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.5, 3.8), new THREE.MeshStandardMaterial({color: 0x5c4033}));
      doorMesh.position.set(0, 1.75, 1.9); 
      doorPivot.add(doorMesh);
      roomGroup.add(doorPivot);
      
      this.wallMeshes.push(doorMesh);
      this.interactables.push({ 
          mesh: doorMesh, 
          type: 'door', 
          hoverText: '開啟 / 關閉 教室門', 
          data: { pivot: doorPivot, isOpen: false, targetRot: 0 } 
      });
      this.doors.push(this.interactables[this.interactables.length-1].data);

      const bb = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), mBlackboard);
      bb.rotation.y = Math.PI/2; bb.position.set(-12.9, 2, zCenter);
      roomGroup.add(bb);
      this.interactables.push({ mesh: bb, type: 'puzzle', hoverText: '查看黑板謎題' });

      const tDesk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 3), new THREE.MeshStandardMaterial({color:0x443322}));
      tDesk.position.set(-10, 0.5, zCenter - 3);
      roomGroup.add(tDesk); this.wallMeshes.push(tDesk);

      const pc = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.6), new THREE.MeshStandardMaterial({color: 0x111111}));
      pc.position.set(-10, 1.2, zCenter - 3);
      roomGroup.add(pc);
      this.interactables.push({ mesh: pc, type: 'computer', hoverText: '終端機 [需要破解]' });

      this.buildLocker(roomGroup, -12, zCenter + 5, Math.PI);

      for(let x=0; x<2; x++) {
          for(let z=0; z<3; z++) {
              if (Math.random() > 0.4) {
                  const desk = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1.5), new THREE.MeshStandardMaterial({color:0x554433}));
                  desk.position.set(-6 - (x*2.5), 0.4, zCenter - 2 + (z*2));
                  desk.rotation.y = (Math.random() - 0.5);
                  
                  if (Math.random() > 0.8) {
                      desk.rotation.z = Math.PI/2;
                      desk.position.y = 0.5;
                  }
                  roomGroup.add(desk); this.wallMeshes.push(desk);
                  this.interactables.push({ mesh: desk, type: 'flavor', hoverText: '查看課桌', data: this.getRand(FLAVOR_TEXTS.objects) });
              }
          }
      }

      parent.add(roomGroup);
  }
  
  private buildLocker(parent: THREE.Group, x: number, z: number, rotY: number) {
      const g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = rotY;
      const body = new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 1), new THREE.MeshStandardMaterial({color: 0x444444}));
      body.position.y = 1.75; g.add(body); this.wallMeshes.push(body);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.4, 0.9), new THREE.MeshStandardMaterial({color: 0x555555}));
      door.position.set(0.5, 1.75, 0); g.add(door);
      this.interactables.push({ mesh: door, type: 'locker', hoverText: '躲進去', data: {pos: new THREE.Vector3(x,0,z)}});
      parent.add(g);
  }
  
  private buildElevator(parent: THREE.Group, zPos: number) {
      const elevatorGroup = new THREE.Group();
      elevatorGroup.position.set(0, 0, zPos);
      const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 0.2), new THREE.MeshStandardMaterial({color: 0x555555}));
      leftDoor.position.set(-0.75, 1.75, 0.4);
      const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 0.2), new THREE.MeshStandardMaterial({color: 0x555555}));
      rightDoor.position.set(0.75, 1.75, 0.4);
      elevatorGroup.add(leftDoor); elevatorGroup.add(rightDoor);
      this.wallMeshes.push(leftDoor); this.wallMeshes.push(rightDoor);
      
      const frame = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 1), new THREE.MeshStandardMaterial({color: 0x222}));
      frame.position.set(0, 2, 0);
      this.interactables.push({ mesh: frame, type: 'elevator_call', hoverText: '呼叫電梯', data: { left: leftDoor, right: rightDoor } });
      elevatorGroup.add(frame);
      parent.add(elevatorGroup);
  }

  // --- 互動系統 ---

  private checkInteractions() {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
      const nearby = this.interactables.filter(i => i.mesh.parent && this.camera.position.distanceTo(i.mesh.getWorldPosition(new THREE.Vector3())) < CONFIG.interactDist);
      const hits = ray.intersectObjects(nearby.map(i => i.mesh));
      
      if (hits.length > 0) {
          const t = nearby.find(i => i.mesh === hits[0].object);
          this.showInteract.set(true);
          this.interactText.set(t.hoverText);
          
          if (this.inputInteraction) {
              this.handleInteraction(t);
              this.inputInteraction = false;
          }
      } else {
          this.showInteract.set(false);
      }
  }
  
  private handleInteraction(target: any) {
      this.playSound('click');
      switch(target.type) {
          case 'pickup':
              if (target.data === 'BATTERY') {
                  this.battery.set(100);
                  this.showToast("更換電池 (100%)");
              } else if (target.data === 'KEY') {
                  this.inventory.update(i => [...i, 'KEY']);
                  this.showToast("獲得：舊校舍鑰匙");
              } else if (target.data === 'BANDAGE') {
                  this.statusEffects.update(s => s.filter(e => e !== 'BLEEDING'));
                  this.health.update(h => Math.min(100, h + 20));
                  this.showToast("使用繃帶：止血並恢復生命");
              } else if (target.data === 'PILLS') {
                  this.sanity.update(s => Math.min(100, s + 40));
                  this.showToast("吞下鎮靜劑：理智恢復");
              }
              target.mesh.parent.remove(target.mesh);
              this.interactables = this.interactables.filter(i => i !== target);
              break;
          case 'door':
              target.data.isOpen = !target.data.isOpen;
              target.data.targetRot = target.data.isOpen ? -Math.PI/2 : 0;
              this.showToast(target.data.isOpen ? "門開了" : "門關了");
              break;
          case 'locker':
              this.enterHiding();
              break;
          case 'puzzle': 
              this.startPuzzle(); 
              break;
          case 'computer': 
              this.startHacking(); 
              break;
          case 'note': 
              this.currentNote.set(target.data); 
              this.gameState.set('READING'); 
              if (!this.isMobile()) this.controls.unlock(); 
              break;
          case 'flavor':
              this.triggerMonologue(target.data, 3000);
              break;
          case 'elevator_call':
              if (this.puzzlesSolved() >= 10) this.openElevator(target.data);
              else this.showToast(`電梯系統鎖定中 (已解鎖: ${this.puzzlesSolved()}/10)`);
              break;
      }
  }

  // --- 輸入與工具 ---
  private inputInteraction = false;

  private setupInputs() {
      document.addEventListener('keydown', (e) => {
          if (e.repeat) return; 
          
          if (this.gameState() === 'PLAYING') {
              switch(e.code) {
                  case 'KeyW': this.input.fwd = 1; break;
                  case 'KeyS': this.input.fwd = -1; break;
                  case 'KeyA': this.input.right = -1; break;
                  case 'KeyD': this.input.right = 1; break;
                  case 'ShiftLeft': this.isRunning = true; break;
                  case 'KeyC': this.isCrouching = true; break;
                  case 'KeyF': this.flashlightOn = !this.flashlightOn; this.playSound('click'); break;
                  case 'KeyE': this.inputInteraction = true; setTimeout(()=>this.inputInteraction=false, 100); break;
              }
              if (Math.random() < 0.001) this.triggerMonologue(this.getRand(MONOLOGUES.idle), 3000);

          } else if (this.gameState() === 'PAUSED') {
              if (e.code === 'Escape') this.togglePause();

          } else if (this.gameState() === 'HIDING') {
              if (e.code === 'KeyE') this.exitHiding();
          } else if (this.gameState() === 'READING') {
              if (e.code === 'KeyE' || e.code === 'Escape') { this.gameState.set('PLAYING'); this.safeLock(); }
          }
      });
      document.addEventListener('keyup', (e) => {
          if (e.code === 'KeyW' || e.code === 'KeyS') this.input.fwd = 0;
          if (e.code === 'KeyA' || e.code === 'KeyD') this.input.right = 0;
          if (e.code === 'ShiftLeft') this.isRunning = false;
          if (e.code === 'KeyC') this.isCrouching = false;
      });
  }

  togglePause() {
      if (this.gameState() === 'PLAYING') {
          this.gameState.set('PAUSED');
          if (!this.isMobile()) this.controls.unlock();
      } else if (this.gameState() === 'PAUSED') {
          this.gameState.set('PLAYING');
          this.safeLock();
      }
  }

  applyStatus(effect: string) {
      if (!this.statusEffects().includes(effect)) {
          this.statusEffects.update(s => [...s, effect]);
      }
  }

  enterHiding() {
      this.gameState.set('HIDING');
      this.lastPosBeforeHide.copy(this.camera.position);
      this.flashlightOn = false;
      this.showToast("已躲藏 (手電筒自動關閉)");
  }
  exitHiding() {
      this.gameState.set('PLAYING');
      this.camera.position.copy(this.lastPosBeforeHide);
  }
  
  private addTutorialNote() {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color:0x333}));
      t.position.set(0, 0.5, -3); this.scene.add(t); this.wallMeshes.push(t);
      const n = new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.4), new THREE.MeshBasicMaterial({color:0xfff}));
      n.rotation.x=-Math.PI/2; n.position.set(0, 1.01, -3); this.scene.add(n);
      this.interactables.push({mesh:n, type:'note', hoverText:'閱讀', data:'【生存指南】\n1. 鬼魂會在B2層開始出現。\n2. 若聽見心跳聲，立刻找鐵櫃躲藏。\n3. 解開10個謎題才能啟動電梯離開。\n4. 省著點用手電筒...黑暗會吞噬你的理智。\n5. [ESC] 可暫停。\n6. 注意流血狀態，尋找繃帶。'});
  }

  private triggerMonologue(txt: string, dur: number) {
      this.currentMonologue.set(txt);
      setTimeout(() => this.currentMonologue.set(''), dur);
  }
  
  private showToast(msg: string) {
      this.notifications.update(n => [...n, msg]);
      setTimeout(() => this.notifications.update(n => n.slice(1)), 3000);
  }

  private playSound(type: string) {
      if(!this.audioCtx) {
           this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
           this.masterGain = this.audioCtx.createGain();
           this.masterGain.connect(this.audioCtx.destination);
      }
      const osc = this.audioCtx.createOscillator();
      const g = this.audioCtx.createGain();
      osc.connect(g).connect(this.masterGain!);
      const now = this.audioCtx.currentTime;
      
      if(type==='click') {
          osc.frequency.setValueAtTime(800, now);
          g.gain.setValueAtTime(0.1, now);
          g.gain.exponentialRampToValueAtTime(0.01, now+0.1);
          osc.start(now); osc.stop(now+0.1);
      } else if(type==='scream') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.linearRampToValueAtTime(1200, now+0.5);
          g.gain.setValueAtTime(0.5, now);
          g.gain.linearRampToValueAtTime(0, now+1.0);
          osc.start(now); osc.stop(now+1.0);
      } else {
          osc.type='triangle';
          osc.frequency.setValueAtTime(100, now);
          g.gain.setValueAtTime(0.2, now);
          g.gain.exponentialRampToValueAtTime(0.01, now+0.5);
          osc.start(now); osc.stop(now+0.5);
      }
  }

  private getMat(type: string): THREE.Material {
      const canvas = document.createElement('canvas');
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = (type==='floor')?'#1a1a1a':(type==='wall'?'#2a2a2a':'#000');
      ctx.fillRect(0,0,128,128);
      for(let i=0;i<200;i++) {
          ctx.fillStyle=`rgba(0,0,0,${Math.random()*0.3})`;
          ctx.fillRect(Math.random()*128,Math.random()*128,4,4);
      }
      if(Math.random() < 0.3) {
          ctx.fillStyle='rgba(100,0,0,0.5)';
          ctx.beginPath();
          ctx.arc(64, 64, Math.random()*30, 0, Math.PI*2);
          ctx.fill();
      }
      const t = new THREE.CanvasTexture(canvas);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return new THREE.MeshStandardMaterial({map:t, roughness: 0.8});
  }

  startPuzzle(){ this.gameState.set('PUZZLE'); if(!this.isMobile()) this.controls.unlock(); this.currentPuzzle.set(this.getRand(MATH_PUZZLES)); }
  startHacking(){ this.gameState.set('HACKING'); if(!this.isMobile()) this.controls.unlock(); this.currentHack.set(this.getRand(HACK_CHALLENGES)); }
  
  submitPuzzle(a: string) { 
      if(a.trim() === this.currentPuzzle().a) { 
          this.puzzlesSolved.update(n=>n+1); 
          this.closePuzzle(); 
          this.showToast("解答正確！"); 
          this.playSound('click');
      } else {
          this.showToast("錯誤！");
          this.playSound('click');
      }
  }
  
  submitHack(a: string) { 
      if(a === this.currentHack().ans) { 
          this.puzzlesSolved.update(n => Math.min(10, n+2)); 
          this.closePuzzle(); 
          this.showToast("系統破解成功！(進度+2)"); 
          this.playSound('click');
      } else { 
          this.showToast("破解失敗 - 安全系統鎖定");
          this.playSound('click');
          this.closePuzzle();
      } 
  }
  
  closePuzzle() { this.gameState.set('PLAYING'); this.safeLock(); }
  
  getRand(a:any[]){ return a[Math.floor(Math.random()*a.length)]; }
  
  triggerDeath(msg: string) { this.gameState.set('DEAD'); this.puzzleMsg.set(msg); if(!this.isMobile()) this.controls.unlock(); }
  
  startGame() { 
      this.gameState.set('PLAYING'); 
      if(!this.renderer) this.initThreeJS(); 
      setTimeout(() => this.safeLock(), 50);
  }
  
  openElevator(data:any) {
      data.left.position.x = -2; data.right.position.x = 2; 
      this.playSound('click');
      this.triggerElevatorRide();
  }
  
  triggerElevatorRide() {
      this.gameState.set('ELEVATOR_RIDE');
      setTimeout(()=>{
          this.floor.update(f=>f+1);
          this.puzzlesSolved.set(0);
          this.gameState.set('PLAYING');
          this.camera.position.set(0,1.7,0);
          this.genPos.set(0,0,0);
          
          this.mapSegments.forEach(s=>this.scene.remove(s.group));
          this.mapSegments=[]; this.wallMeshes=[]; this.interactables=[]; this.activeGhosts=[];
          this.doors = []; 
          
          this.spawnNextSegment(true); this.spawnNextSegment();
          this.showToast("抵達 B"+this.floor());
          this.triggerMonologue(this.floor() >= 2 ? "空氣變冷了...它們來了。" : "這裡暫時安全...", 4000);
      }, 4000);
  }

  reload() {
    window.location.reload();
  }
}