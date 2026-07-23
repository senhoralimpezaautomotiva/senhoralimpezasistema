var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: __accessProp.bind(mod, key),
        enumerable: true
      });
  if (canCache)
    cache.set(mod, to);
  return to;
};

// server.ts
var import_express = __toESM(require("express"));
var import_vite = require("vite");

// src/db/supabaseClient.ts
var import_supabase_js = require("@supabase/supabase-js");
var sharedClient = null;
var sharedUrl = "";
var sharedAnonKey = "";
function getSharedSupabaseClient(url, anonKey) {
  if (!url || !anonKey) {
    throw new Error("Supabase URL e chave pública são obrigatórias.");
  }
  if (!sharedClient || sharedUrl !== url || sharedAnonKey !== anonKey) {
    const isBrowser = typeof window !== "undefined";
    sharedClient = import_supabase_js.createClient(url, anonKey, {
      auth: {
        persistSession: isBrowser,
        autoRefreshToken: isBrowser,
        detectSessionInUrl: isBrowser
      }
    });
    sharedUrl = url;
    sharedAnonKey = anonKey;
  }
  return sharedClient;
}

// src/data/prefilledModels.ts
var PREFILLED_VEHICLE_MODELS = [
  { id: "fiat-uno", manufacturer: "Fiat", model: "Uno", size_category: "P", active: true },
  { id: "fiat-mobi", manufacturer: "Fiat", model: "Mobi", size_category: "P", active: true },
  { id: "fiat-argo", manufacturer: "Fiat", model: "Argo", size_category: "P", active: true },
  { id: "fiat-palio", manufacturer: "Fiat", model: "Palio", size_category: "P", active: true },
  { id: "fiat-siena", manufacturer: "Fiat", model: "Siena", size_category: "M", active: true },
  { id: "fiat-grand-siena", manufacturer: "Fiat", model: "Grand Siena", size_category: "M", active: true },
  { id: "fiat-cronos", manufacturer: "Fiat", model: "Cronos", size_category: "M", active: true },
  { id: "fiat-palio-weekend", manufacturer: "Fiat", model: "Palio Weekend", size_category: "M", active: true },
  { id: "fiat-punto", manufacturer: "Fiat", model: "Punto", size_category: "P", active: true },
  { id: "fiat-idea", manufacturer: "Fiat", model: "Idea", size_category: "M", active: true },
  { id: "fiat-doblo", manufacturer: "Fiat", model: "Doblò", size_category: "G", active: true },
  { id: "fiat-fiorino", manufacturer: "Fiat", model: "Fiorino", size_category: "G", active: true },
  { id: "fiat-strada", manufacturer: "Fiat", model: "Strada", size_category: "G", active: true },
  { id: "fiat-toro", manufacturer: "Fiat", model: "Toro", size_category: "G", active: true },
  { id: "fiat-pulse", manufacturer: "Fiat", model: "Pulse", size_category: "M", active: true },
  { id: "fiat-fastback", manufacturer: "Fiat", model: "Fastback", size_category: "M", active: true },
  { id: "fiat-freemont", manufacturer: "Fiat", model: "Freemont", size_category: "G", active: true },
  { id: "vw-gol", manufacturer: "Volkswagen", model: "Gol", size_category: "P", active: true },
  { id: "vw-voyage", manufacturer: "Volkswagen", model: "Voyage", size_category: "M", active: true },
  { id: "vw-fox", manufacturer: "Volkswagen", model: "Fox", size_category: "P", active: true },
  { id: "vw-up", manufacturer: "Volkswagen", model: "Up", size_category: "P", active: true },
  { id: "vw-polo-hatch", manufacturer: "Volkswagen", model: "Polo Hatch", size_category: "P", active: true },
  { id: "vw-polo-sedan", manufacturer: "Volkswagen", model: "Polo Sedan", size_category: "M", active: true },
  { id: "vw-virtus", manufacturer: "Volkswagen", model: "Virtus", size_category: "M", active: true },
  { id: "vw-saveiro", manufacturer: "Volkswagen", model: "Saveiro", size_category: "G", active: true },
  { id: "vw-parati", manufacturer: "Volkswagen", model: "Parati", size_category: "M", active: true },
  { id: "vw-crossfox", manufacturer: "Volkswagen", model: "CrossFox", size_category: "M", active: true },
  { id: "vw-spacefox", manufacturer: "Volkswagen", model: "SpaceFox", size_category: "M", active: true },
  { id: "vw-golf", manufacturer: "Volkswagen", model: "Golf", size_category: "M", active: true },
  { id: "vw-bora", manufacturer: "Volkswagen", model: "Bora", size_category: "M", active: true },
  { id: "vw-jetta", manufacturer: "Volkswagen", model: "Jetta", size_category: "M", active: true },
  { id: "vw-passat", manufacturer: "Volkswagen", model: "Passat", size_category: "M", active: true },
  { id: "vw-nivus", manufacturer: "Volkswagen", model: "Nivus", size_category: "M", active: true },
  { id: "vw-t-cross", manufacturer: "Volkswagen", model: "T-Cross", size_category: "M", active: true },
  { id: "vw-taos", manufacturer: "Volkswagen", model: "Taos", size_category: "G", active: true },
  { id: "vw-tiguan", manufacturer: "Volkswagen", model: "Tiguan", size_category: "G", active: true },
  { id: "vw-touareg", manufacturer: "Volkswagen", model: "Touareg", size_category: "G", active: true },
  { id: "gm-celta", manufacturer: "Chevrolet", model: "Celta", size_category: "P", active: true },
  { id: "gm-classic", manufacturer: "Chevrolet", model: "Classic", size_category: "M", active: true },
  { id: "gm-corsa-hatch", manufacturer: "Chevrolet", model: "Corsa Hatch", size_category: "P", active: true },
  { id: "gm-corsa-sedan", manufacturer: "Chevrolet", model: "Corsa Sedan", size_category: "M", active: true },
  { id: "gm-corsa-wagon", manufacturer: "Chevrolet", model: "Corsa Wagon", size_category: "M", active: true },
  { id: "gm-prisma", manufacturer: "Chevrolet", model: "Prisma", size_category: "M", active: true },
  { id: "gm-onix-hatch", manufacturer: "Chevrolet", model: "Onix Hatch", size_category: "P", active: true },
  { id: "gm-onix-plus", manufacturer: "Chevrolet", model: "Onix Plus", size_category: "M", active: true },
  { id: "gm-agile", manufacturer: "Chevrolet", model: "Agile", size_category: "M", active: true },
  { id: "gm-sonic-hatch", manufacturer: "Chevrolet", model: "Sonic Hatch", size_category: "P", active: true },
  { id: "gm-sonic-sedan", manufacturer: "Chevrolet", model: "Sonic Sedan", size_category: "M", active: true },
  { id: "gm-cruze-hatch", manufacturer: "Chevrolet", model: "Cruze Hatch", size_category: "M", active: true },
  { id: "gm-cruze-sedan", manufacturer: "Chevrolet", model: "Cruze Sedan", size_category: "M", active: true },
  { id: "gm-vectra", manufacturer: "Chevrolet", model: "Vectra", size_category: "M", active: true },
  { id: "gm-astra", manufacturer: "Chevrolet", model: "Astra", size_category: "M", active: true },
  { id: "gm-meriva", manufacturer: "Chevrolet", model: "Meriva", size_category: "M", active: true },
  { id: "gm-zafira", manufacturer: "Chevrolet", model: "Zafira", size_category: "G", active: true },
  { id: "gm-spin", manufacturer: "Chevrolet", model: "Spin", size_category: "G", active: true },
  { id: "gm-tracker", manufacturer: "Chevrolet", model: "Tracker", size_category: "M", active: true },
  { id: "gm-captiva", manufacturer: "Chevrolet", model: "Captiva", size_category: "G", active: true },
  { id: "gm-equinox", manufacturer: "Chevrolet", model: "Equinox", size_category: "G", active: true },
  { id: "gm-trailblazer", manufacturer: "Chevrolet", model: "Trailblazer", size_category: "G", active: true },
  { id: "gm-montana", manufacturer: "Chevrolet", model: "Montana", size_category: "G", active: true },
  { id: "gm-s10", manufacturer: "Chevrolet", model: "S10", size_category: "G", active: true },
  { id: "gm-blazer", manufacturer: "Chevrolet", model: "Blazer", size_category: "G", active: true },
  { id: "ford-ka-hatch", manufacturer: "Ford", model: "Ka Hatch", size_category: "P", active: true },
  { id: "ford-ka-sedan", manufacturer: "Ford", model: "Ka Sedan", size_category: "M", active: true },
  { id: "ford-fiesta-hatch", manufacturer: "Ford", model: "Fiesta Hatch", size_category: "P", active: true },
  { id: "ford-fiesta-sedan", manufacturer: "Ford", model: "Fiesta Sedan", size_category: "M", active: true },
  { id: "ford-ecosport", manufacturer: "Ford", model: "EcoSport", size_category: "M", active: true },
  { id: "ford-focus-hatch", manufacturer: "Ford", model: "Focus Hatch", size_category: "M", active: true },
  { id: "ford-focus-sedan", manufacturer: "Ford", model: "Focus Sedan", size_category: "M", active: true },
  { id: "ford-fusion", manufacturer: "Ford", model: "Fusion", size_category: "G", active: true },
  { id: "ford-escort", manufacturer: "Ford", model: "Escort", size_category: "M", active: true },
  { id: "ford-verona", manufacturer: "Ford", model: "Verona", size_category: "M", active: true },
  { id: "ford-del-rey", manufacturer: "Ford", model: "Del Rey", size_category: "M", active: true },
  { id: "ford-corcel", manufacturer: "Ford", model: "Corcel", size_category: "M", active: true },
  { id: "ford-belina", manufacturer: "Ford", model: "Belina", size_category: "M", active: true },
  { id: "ford-pampa", manufacturer: "Ford", model: "Pampa", size_category: "G", active: true },
  { id: "ford-courier", manufacturer: "Ford", model: "Courier", size_category: "G", active: true },
  { id: "ford-ranger", manufacturer: "Ford", model: "Ranger", size_category: "G", active: true },
  { id: "ford-maverick", manufacturer: "Ford", model: "Maverick", size_category: "G", active: true },
  { id: "ford-territory", manufacturer: "Ford", model: "Territory", size_category: "G", active: true },
  { id: "ford-edge", manufacturer: "Ford", model: "Edge", size_category: "G", active: true },
  { id: "ford-explorer", manufacturer: "Ford", model: "Explorer", size_category: "G", active: true },
  { id: "jeep-renegade", manufacturer: "Jeep", model: "Renegade", size_category: "M", active: true },
  { id: "jeep-compass", manufacturer: "Jeep", model: "Compass", size_category: "G", active: true },
  { id: "jeep-commander", manufacturer: "Jeep", model: "Commander", size_category: "G", active: true },
  { id: "jeep-cherokee", manufacturer: "Jeep", model: "Cherokee", size_category: "G", active: true },
  { id: "jeep-grand-cherokee", manufacturer: "Jeep", model: "Grand Cherokee", size_category: "G", active: true },
  { id: "jeep-wrangler-2d", manufacturer: "Jeep", model: "Wrangler 2 Portas", size_category: "G", active: true },
  { id: "jeep-wrangler-4d", manufacturer: "Jeep", model: "Wrangler 4 Portas", size_category: "G", active: true },
  { id: "jeep-gladiator", manufacturer: "Jeep", model: "Gladiator", size_category: "G", active: true },
  { id: "toyota-etios-hatch", manufacturer: "Toyota", model: "Etios Hatch", size_category: "P", active: true },
  { id: "toyota-etios-sedan", manufacturer: "Toyota", model: "Etios Sedan", size_category: "M", active: true },
  { id: "toyota-yaris-hatch", manufacturer: "Toyota", model: "Yaris Hatch", size_category: "P", active: true },
  { id: "toyota-yaris-sedan", manufacturer: "Toyota", model: "Yaris Sedan", size_category: "M", active: true },
  { id: "toyota-corolla", manufacturer: "Toyota", model: "Corolla", size_category: "M", active: true },
  { id: "toyota-corolla-cross", manufacturer: "Toyota", model: "Corolla Cross", size_category: "G", active: true },
  { id: "toyota-rav4", manufacturer: "Toyota", model: "RAV4", size_category: "G", active: true },
  { id: "toyota-sw4", manufacturer: "Toyota", model: "SW4", size_category: "G", active: true },
  { id: "toyota-hilux-cs", manufacturer: "Toyota", model: "Hilux Cabine Simples", size_category: "G", active: true },
  { id: "toyota-hilux-cd", manufacturer: "Toyota", model: "Hilux Cabine Dupla", size_category: "G", active: true },
  { id: "toyota-bandeirante", manufacturer: "Toyota", model: "Bandeirante", size_category: "G", active: true },
  { id: "honda-fit", manufacturer: "Honda", model: "Fit", size_category: "M", active: true },
  { id: "honda-city-hatch", manufacturer: "Honda", model: "City Hatch", size_category: "P", active: true },
  { id: "honda-city-sedan", manufacturer: "Honda", model: "City Sedan", size_category: "M", active: true },
  { id: "honda-civic-hatch", manufacturer: "Honda", model: "Civic Hatch", size_category: "M", active: true },
  { id: "honda-civic-sedan", manufacturer: "Honda", model: "Civic Sedan", size_category: "M", active: true },
  { id: "honda-accord", manufacturer: "Honda", model: "Accord", size_category: "G", active: true },
  { id: "honda-wr-v", manufacturer: "Honda", model: "WR-V", size_category: "M", active: true },
  { id: "honda-hr-v", manufacturer: "Honda", model: "HR-V", size_category: "M", active: true },
  { id: "honda-zr-v", manufacturer: "Honda", model: "ZR-V", size_category: "G", active: true },
  { id: "honda-cr-v", manufacturer: "Honda", model: "CR-V", size_category: "G", active: true },
  { id: "honda-passport", manufacturer: "Honda", model: "Passport", size_category: "G", active: true },
  { id: "honda-pilot", manufacturer: "Honda", model: "Pilot", size_category: "G", active: true },
  { id: "mfr-bmw", manufacturer: "BMW", model: "", size_category: "M", active: true },
  { id: "mfr-mercedes", manufacturer: "Mercedes-Benz", model: "", size_category: "M", active: true },
  { id: "mfr-volvo", manufacturer: "Volvo", model: "", size_category: "M", active: true }
];

// src/utils/dateUtils.ts
function getCurrentDate() {
  return new Date;
}
function getCurrentDateStr() {
  const d = getCurrentDate();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// src/db/localDb.ts
var KEYS = {
  CUSTOMERS: "sl_customers",
  VEHICLES: "sl_vehicles",
  SERVICES: "sl_services",
  APPOINTMENTS: "sl_appointments",
  HISTORY: "sl_history",
  FINANCES: "sl_finances",
  CONFIG: "sl_config",
  AUTOMATIONS: "sl_automations",
  LOGS: "sl_logs",
  VEHICLE_MODELS: "sl_vehicle_models",
  USERS: "sl_users",
  COMMISSIONS: "sl_commissions"
};
var DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    clientes: { view: true, create: true, edit: true, delete: true },
    servicos: { view: true, create: true, edit: true, delete: true },
    agenda: { view: true, create: true, edit: true, delete: true },
    historico: { view: true, create: true, edit: true, delete: true },
    financeiro: { view: true, create: true, edit: true, delete: true },
    relatorios: { view: true, create: true, edit: true, delete: true },
    mensagens: { view: true, create: true, edit: true, delete: true },
    automacoes: { view: true, create: true, edit: true, delete: true },
    indicacoes: { view: true, create: true, edit: true, delete: true },
    configuracoes: { view: true, create: true, edit: true, delete: true },
    usuarios: { view: true, create: true, edit: true, delete: true }
  },
  gerente: {
    dashboard: { view: true, create: true, edit: true, delete: true },
    clientes: { view: true, create: true, edit: true, delete: true },
    servicos: { view: true, create: true, edit: true, delete: true },
    agenda: { view: true, create: true, edit: true, delete: true },
    historico: { view: true, create: true, edit: true, delete: true },
    financeiro: { view: true, create: true, edit: true, delete: true },
    relatorios: { view: true, create: true, edit: true, delete: false },
    mensagens: { view: true, create: true, edit: true, delete: true },
    automacoes: { view: true, create: true, edit: true, delete: false },
    indicacoes: { view: true, create: true, edit: true, delete: true },
    configuracoes: { view: true, create: false, edit: true, delete: false },
    usuarios: { view: true, create: true, edit: true, delete: false }
  },
  atendente: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    clientes: { view: true, create: true, edit: true, delete: false },
    servicos: { view: true, create: false, edit: false, delete: false },
    agenda: { view: true, create: true, edit: true, delete: false },
    historico: { view: true, create: true, edit: false, delete: false },
    financeiro: { view: true, create: true, edit: false, delete: false },
    relatorios: { view: true, create: false, edit: false, delete: false },
    mensagens: { view: true, create: true, edit: false, delete: false },
    automacoes: { view: false, create: false, edit: false, delete: false },
    indicacoes: { view: true, create: true, edit: true, delete: false },
    configuracoes: { view: false, create: false, edit: false, delete: false },
    usuarios: { view: false, create: false, edit: false, delete: false }
  },
  tecnico: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    clientes: { view: true, create: false, edit: false, delete: false },
    servicos: { view: true, create: false, edit: false, delete: false },
    agenda: { view: true, create: false, edit: true, delete: false },
    historico: { view: true, create: true, edit: false, delete: false },
    financeiro: { view: false, create: false, edit: false, delete: false },
    relatorios: { view: false, create: false, edit: false, delete: false },
    mensagens: { view: false, create: false, edit: false, delete: false },
    automacoes: { view: false, create: false, edit: false, delete: false },
    indicacoes: { view: false, create: false, edit: false, delete: false },
    configuracoes: { view: false, create: false, edit: false, delete: false },
    usuarios: { view: false, create: false, edit: false, delete: false }
  },
  personalizado: {
    dashboard: { view: true, create: false, edit: false, delete: false },
    clientes: { view: true, create: true, edit: true, delete: false },
    servicos: { view: true, create: false, edit: false, delete: false },
    agenda: { view: true, create: true, edit: true, delete: false },
    historico: { view: true, create: false, edit: false, delete: false },
    financeiro: { view: false, create: false, edit: false, delete: false },
    relatorios: { view: false, create: false, edit: false, delete: false },
    mensagens: { view: false, create: false, edit: false, delete: false },
    automacoes: { view: false, create: false, edit: false, delete: false },
    indicacoes: { view: false, create: false, edit: false, delete: false },
    configuracoes: { view: false, create: false, edit: false, delete: false },
    usuarios: { view: false, create: false, edit: false, delete: false }
  }
};
var DEFAULT_USERS = [
  {
    id: "u_admin_1",
    name: "Administrador Master",
    phone: "(11) 99999-8888",
    email: "contato@senhoralimpeza.com.br",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    status: "ativo",
    role: "admin",
    permissions: DEFAULT_ROLE_PERMISSIONS.admin,
    commissions: [],
    defaultCommissionPercent: 15,
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "u_tecnico_1",
    name: "Gabriel Silva",
    phone: "(11) 98888-7777",
    email: "gabriel@senhoralimpeza.com.br",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    status: "ativo",
    role: "tecnico",
    permissions: DEFAULT_ROLE_PERMISSIONS.tecnico,
    commissions: [
      { serviceId: "8350c53e-fa9b-4c1d-ba6b-d18198c7b94e", percentage: 20 },
      { serviceId: "7a2d3359-9e6b-41bc-a7f8-0e84c7bd083a", percentage: 25 }
    ],
    defaultCommissionPercent: 12,
    createdAt: "2026-01-02T00:00:00.000Z"
  },
  {
    id: "u_atendente_1",
    name: "Matheus Oliveira",
    phone: "(11) 97777-6666",
    email: "matheus@senhoralimpeza.com.br",
    photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    status: "ativo",
    role: "atendente",
    permissions: DEFAULT_ROLE_PERMISSIONS.atendente,
    commissions: [],
    defaultCommissionPercent: 5,
    createdAt: "2026-01-03T00:00:00.000Z"
  }
];
var DEFAULT_CONFIG = {
  companyName: "Senhora Limpeza Estética Automotiva",
  phone: "(11) 99999-8888",
  email: "contato@senhoralimpeza.com.br",
  cnpj: "45.123.789/0001-99",
  address: "Av. das Nações Unidas, 14205 - Brooklin Novo, São Paulo - SP",
  hoursOfOperation: "Segunda a Sexta: 08:00 às 18:00 | Sábado: 08:00 às 14:00",
  logoUrl: "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=150&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
  primaryColor: "#0F172A",
  accentColor: "#0EA5E9",
  supabaseUrl: "https://ansrnnydksrjwefnntaw.supabase.co",
  supabaseAnonKey: "sb_publishable_vbMMkzHsGfSd5Gyg_7zogg_YUIBB7gg",
  useRealSupabase: true,
  zapiInstanceId: "",
  zapiToken: "",
  makeWebhookUrl: "",
  referralActive: true,
  referralDiscountPercent: 10,
  automationStartHour: "08:00",
  automationEndHour: "20:00",
  theme: "dark",
  agenda: {
    days: [
      { dayOfWeek: 0, dayName: "Domingo", isActive: false, openTime: "08:00", closeTime: "12:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" },
      { dayOfWeek: 1, dayName: "Segunda-feira", isActive: true, openTime: "08:00", closeTime: "18:00", hasLunchBreak: true, lunchStart: "12:00", lunchEnd: "13:00" },
      { dayOfWeek: 2, dayName: "Terça-feira", isActive: true, openTime: "08:00", closeTime: "18:00", hasLunchBreak: true, lunchStart: "12:00", lunchEnd: "13:00" },
      { dayOfWeek: 3, dayName: "Quarta-feira", isActive: true, openTime: "08:00", closeTime: "18:00", hasLunchBreak: true, lunchStart: "12:00", lunchEnd: "13:00" },
      { dayOfWeek: 4, dayName: "Quinta-feira", isActive: true, openTime: "08:00", closeTime: "18:00", hasLunchBreak: true, lunchStart: "12:00", lunchEnd: "13:00" },
      { dayOfWeek: 5, dayName: "Sexta-feira", isActive: true, openTime: "08:00", closeTime: "18:00", hasLunchBreak: true, lunchStart: "12:00", lunchEnd: "13:00" },
      { dayOfWeek: 6, dayName: "Sábado", isActive: true, openTime: "08:00", closeTime: "14:00", hasLunchBreak: false, lunchStart: "12:00", lunchEnd: "13:00" }
    ],
    timeSlots: [
      { id: "ts_1", time: "08:00", maxCapacity: 2 },
      { id: "ts_2", time: "09:00", maxCapacity: 2 },
      { id: "ts_3", time: "10:00", maxCapacity: 2 },
      { id: "ts_4", time: "11:00", maxCapacity: 2 },
      { id: "ts_5", time: "12:00", maxCapacity: 1 },
      { id: "ts_6", time: "13:00", maxCapacity: 2 },
      { id: "ts_7", time: "14:00", maxCapacity: 2 },
      { id: "ts_8", time: "15:00", maxCapacity: 2 },
      { id: "ts_9", time: "16:00", maxCapacity: 2 },
      { id: "ts_10", time: "17:00", maxCapacity: 2 }
    ],
    minAdvanceHours: 2,
    maxAdvanceDays: 60,
    autoBlockDuration: true
  }
};
var DEFAULT_SERVICES = [
  { id: "8350c53e-fa9b-4c1d-ba6b-d18198c7b94e", name: "Lavagem Completa", description: "Inclui aspiração e pretinho", basePrice: 150, estimatedTime: 120, portalVisibility: "lista" },
  { id: "7a2d3359-9e6b-41bc-a7f8-0e84c7bd083a", name: "Polimento Técnico", description: "Necessita agendamento prévio", basePrice: 850, estimatedTime: 480, portalVisibility: "lista" },
  { id: "20970a7d-5e60-4965-a831-28562725f4fb", name: "Higienização Interna Completa", description: "Limpeza profunda de bancos (couro ou tecido) com extratora e sanitização.", basePrice: 380, estimatedTime: 240, portalVisibility: "lista" },
  { id: "0f209673-bf00-4b07-a3ca-f8319688049e", name: "Vitrificação de Pintura (Ceramic Coating)", description: "Proteção de pintura por até 3 anos contra raios UV e seiva.", basePrice: 1400, estimatedTime: 360, portalVisibility: "lista" },
  { id: "4ab97262-e64e-4b68-b3d9-a4773822a969", name: "Limpeza Técnica de Motor", description: "Limpeza a vapor do cofre do motor com verniz de motor protetor.", basePrice: 180, estimatedTime: 90, isFeatured: true, offerText: "Remove graxa/óleo e protege plásticos e borrachas do cofre.", displayOrder: 3, portalVisibility: "sugestao" },
  { id: "8170c0c0-6bf7-4b71-b8ef-ca1c9a66b7fb", name: "Cristalização de Vidros", description: "Remoção de chuva ácida nos vidros e aplicação de selante repelente.", basePrice: 130, estimatedTime: 60, isFeatured: true, offerText: "Garante visibilidade máxima e segurança sob chuvas fortes.", displayOrder: 1, portalVisibility: "sugestao" },
  { id: "3a73967f-94d3-469b-9807-68b209e53b6d", name: "Revitalização de Plásticos", description: "Aplicação de renovador de plásticos externos para reverter desbotamento.", basePrice: 100, estimatedTime: 45, isFeatured: true, offerText: "Devolve a cor original e protege plásticos externos de raios UV.", displayOrder: 2, portalVisibility: "sugestao" },
  { id: "50d30fe9-ca60-4286-9a25-97da259d57a2", name: "Restauração de Faróis", description: "Lixamento de faróis amarelados/foscos e aplicação de selante UV.", basePrice: 160, estimatedTime: 90, isFeatured: true, offerText: "Elimina o amarelado, aumentando o poder de iluminação à noite.", displayOrder: 4, portalVisibility: "sugestao" },
  { id: "e97fa1f2-1b63-4ba0-a0de-47120df05bf9", name: "Detalhamento Completo (Full Detail)", description: "Lavagem de motor, higienização profunda, polimento e vitrificação.", basePrice: 2400, estimatedTime: 960, portalVisibility: "lista" }
];
var DEFAULT_CUSTOMERS = [
  {
    id: "1d7f5c76-7b8c-4687-89b5-750f6808f2f3",
    name: "Cliente Demonstrativo",
    phone: "5511999998888",
    whatsapp: "5511999998888",
    email: "cliente.demonstrativo@exemplo.com",
    cpf: "",
    birthDate: "1990-01-01",
    address: "Av. Paulista, 1000",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    notes: "Cliente demonstrativo padrão do sistema.",
    clientSince: "2026-07-14",
    lastServiceDate: null,
    status: "ativo",
    origin: "Outros"
  }
];
var DEFAULT_VEHICLES = [
  {
    id: "0b412500-8415-4976-8fac-e76723debfb5",
    customerId: "1d7f5c76-7b8c-4687-89b5-750f6808f2f3",
    brand: "Honda",
    model: "Civic",
    version: "Touring 1.5 Turbo",
    year: "2021",
    plate: "ABC1D23",
    color: "Preto",
    mileage: "34200"
  }
];
var DEFAULT_APPOINTMENTS = [];
var DEFAULT_AUTOMATIONS = [
  {
    id: "at1",
    name: "Mensagem de Novo Cliente",
    description: "Envia mensagem de boas-vindas ao cadastrar um novo cliente.",
    event: "novo_cliente",
    isActive: true,
    template: "Olá, *{nome}*! É um grande prazer ter você como cliente da Senhora Limpeza Estética Automotiva. \uD83D\uDE97✨ Cadastramos seu contato com sucesso e estamos à disposição para deixar seu veículo impecável!"
  },
  {
    id: "at2",
    name: "Confirmação de Agendamento",
    description: "Envia confirmação imediata quando um agendamento é criado.",
    event: "novo_agendamento",
    isActive: true,
    template: `Olá, *{nome}*! Confirmamos seu agendamento para o veículo *{veiculo}* em nosso espaço. 

\uD83D\uDCC5 *Data/Hora:* {data_hora}
\uD83D\uDEE0️ *Serviço:* {servico}
\uD83D\uDCB0 *Valor:* R$ {valor}

Te aguardamos no endereço: Av. das Nações Unidas, 14205.`
  },
  {
    id: "at_servico_iniciado",
    name: "Serviço Iniciado",
    description: "Envia notificação quando o veículo entra em processo de limpeza/estética.",
    event: "servico_iniciado",
    isActive: true,
    template: `Olá, *{nome}*! O serviço de *{servico}* no seu *{veiculo}* foi iniciado. \uD83D\uDEE0️\uD83D\uDE97✨

Acompanhamos cada detalhe com o máximo cuidado para garantir um resultado impecável. Notificaremos você assim que o veículo estiver pronto!`
  },
  {
    id: "at3",
    name: "Serviço Finalizado / Retirada",
    description: "Notifica que o serviço terminou e o carro está pronto para retirada.",
    event: "servico_finalizado",
    isActive: true,
    template: `Excelente notícia, *{nome}*! O serviço de *{servico}* no seu *{veiculo}* foi finalizado. O veículo ficou espetacular e já está pronto para retirada! \uD83E\uDDFC\uD83D\uDE97✨

Nosso horário de funcionamento é até as 18:00.`
  },
  {
    id: "at4",
    name: "Recuperação de Cliente Inativo",
    description: "Alerta de lembrete de retorno para clientes há mais de 30 dias sem serviço.",
    event: "cliente_inativo",
    isActive: true,
    template: "Olá, *{nome}*! Faz um tempo que não vemos você e o seu *{veiculo}* por aqui. Que tal darmos aquele trato premium para proteger e brilhar a pintura? Agende hoje mesmo e ganhe uma cristalização de parabrisa cortesia!",
    inactiveDays: 30,
    minServices: 1
  },
  {
    id: "at5",
    name: "Parabéns de Aniversário",
    description: "Envia mensagem com cupom de desconto no dia do aniversário do cliente.",
    event: "aniversario",
    isActive: true,
    template: "Parabéns, *{nome}*! \uD83C\uDF89\uD83C\uDF88 A equipe da Senhora Limpeza te deseja muitos anos de vida, conquistas e estradas tranquilas! Para comemorar, você acaba de ganhar *15% de desconto* em qualquer serviço detalhado neste mês!"
  },
  {
    id: "at6",
    name: "Pesquisa de Satisfação",
    description: "Envia um link de pesquisa após a finalização e entrega do veículo.",
    event: "pagamento_recebido",
    isActive: true,
    template: "Olá, *{nome}*! Agradecemos a preferência pela Senhora Limpeza. Sua opinião é fundamental para nós. Numa escala de 0 a 10, como você avalia o resultado do serviço em seu *{veiculo}*? Responda aqui mesmo!"
  },
  {
    id: "at_lembrete_agendamento",
    name: "Lembrete de Agendamento",
    description: "Envia uma mensagem automática lembrando o cliente sobre seu agendamento iminente (60 minutos antes).",
    event: "lembrete_agendamento",
    isActive: true,
    template: "Olá, *{nome}*! Passando para lembrar que seu agendamento está agendado para hoje às *{data_hora}* com o veículo *{veiculo}* (Serviço: *{servico}*). Estamos te aguardando no endereço: Av. das Nações Unidas, 14205! ✨\uD83D\uDE97"
  }
];
var isServer = typeof window === "undefined" || typeof localStorage === "undefined";
var memStore = {};
var getLocalData = (key, defaultValue) => {
  try {
    const data = isServer ? memStore[key] : localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from storage`, error);
    return defaultValue;
  }
};
var setLocalData = (key, data) => {
  try {
    const str = JSON.stringify(data);
    if (isServer) {
      memStore[key] = str;
    } else {
      localStorage.setItem(key, str);
    }
  } catch (error) {
    console.error(`Error saving ${key} to storage`, error);
  }
};
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function generateReferralCode(existingCustomers) {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let attempts = 0;
  while (attempts < 200) {
    let code = "SL-";
    for (let i = 0;i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const isDup = existingCustomers.some((c) => c.referralCode === code);
    if (!isDup) {
      console.log(`[Referral Audit] Stage 1 (Geração): Código de indicação único gerado com sucesso: ${code}`);
      return code;
    }
    attempts++;
  }
  const fallback = "SL-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  console.log(`[Referral Audit] Stage 1 (Geração): Código de indicação único gerado com sucesso (fallback): ${fallback}`);
  return fallback;
}
function mapDbCustomerToFrontend(row) {
  let name = row.nome || "Sem Nome";
  let email = "";
  let cpf = "";
  let address = "";
  let neighborhood = "";
  let city = "São Paulo";
  let notes = "";
  let status = "ativo";
  let origin = "Outros";
  let referralCode = "";
  let referredBy = "";
  let referralDiscountAvailable = false;
  let referralDiscountUsed = false;
  let referralCreatedAt = "";
  let referralServiceValue = 0;
  let referralBonusPercentUsed = 0;
  let referralBonusAmount = 0;
  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = name.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.email)
        email = meta.email;
      if (meta.cpf)
        cpf = meta.cpf;
      if (meta.address)
        address = meta.address;
      if (meta.neighborhood)
        neighborhood = meta.neighborhood;
      if (meta.city)
        city = meta.city;
      if (meta.notes)
        notes = meta.notes;
      if (meta.status)
        status = meta.status;
      if (meta.origin)
        origin = meta.origin;
      if (meta.referralCode)
        referralCode = meta.referralCode;
      if (meta.referredBy)
        referredBy = meta.referredBy;
      if (meta.referralDiscountAvailable !== undefined)
        referralDiscountAvailable = meta.referralDiscountAvailable;
      if (meta.referralDiscountUsed !== undefined)
        referralDiscountUsed = meta.referralDiscountUsed;
      if (meta.referralCreatedAt)
        referralCreatedAt = meta.referralCreatedAt;
      if (meta.referralServiceValue !== undefined)
        referralServiceValue = meta.referralServiceValue;
      if (meta.referralBonusPercentUsed !== undefined)
        referralBonusPercentUsed = meta.referralBonusPercentUsed;
      if (meta.referralBonusAmount !== undefined)
        referralBonusAmount = meta.referralBonusAmount;
      name = name.replace(metaRegex, "").trim();
    } catch (e) {
      console.error("Erro ao fazer o parse do metadata do cliente:", e);
    }
  }
  if (referralCode) {
    console.log(`[Referral Audit] Stage 3 (Leitura): Código ${referralCode} decodificado do banco para o cliente: ${name}`);
  } else {
    console.log(`[Referral Audit] Stage 3 (Leitura): Cliente ${name} carregado do banco, mas ainda não possui código de indicação no metadata.`);
  }
  return {
    id: row.id,
    name,
    phone: row.telefone || "",
    whatsapp: row.telefone || "",
    email,
    cpf,
    birthDate: row.data_aniversario || "",
    address,
    neighborhood,
    city,
    notes,
    clientSince: row.created_at ? row.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    lastServiceDate: null,
    status,
    origin,
    referralCode,
    referredBy,
    referralDiscountAvailable,
    referralDiscountUsed,
    referralCreatedAt,
    referralServiceValue,
    referralBonusPercentUsed,
    referralBonusAmount
  };
}
function mapFrontendCustomerToDb(c) {
  const row = {};
  if (c.id)
    row.id = c.id;
  let name = c.name || "";
  const hasExtra = c.email || c.cpf || c.address || c.neighborhood || c.city || c.notes || c.status || c.origin || c.referralCode || c.referredBy || c.referralDiscountAvailable !== undefined || c.referralDiscountUsed !== undefined || c.referralCreatedAt || c.referralServiceValue !== undefined || c.referralBonusPercentUsed !== undefined || c.referralBonusAmount !== undefined;
  if (hasExtra && name) {
    const meta = {};
    if (c.email)
      meta.email = c.email;
    if (c.cpf)
      meta.cpf = c.cpf;
    if (c.address)
      meta.address = c.address;
    if (c.neighborhood)
      meta.neighborhood = c.neighborhood;
    if (c.city)
      meta.city = c.city;
    if (c.notes)
      meta.notes = c.notes;
    if (c.status)
      meta.status = c.status;
    if (c.origin)
      meta.origin = c.origin;
    if (c.referralCode)
      meta.referralCode = c.referralCode;
    if (c.referredBy)
      meta.referredBy = c.referredBy;
    if (c.referralDiscountAvailable !== undefined)
      meta.referralDiscountAvailable = c.referralDiscountAvailable;
    if (c.referralDiscountUsed !== undefined)
      meta.referralDiscountUsed = c.referralDiscountUsed;
    if (c.referralCreatedAt)
      meta.referralCreatedAt = c.referralCreatedAt;
    if (c.referralServiceValue !== undefined)
      meta.referralServiceValue = c.referralServiceValue;
    if (c.referralBonusPercentUsed !== undefined)
      meta.referralBonusPercentUsed = c.referralBonusPercentUsed;
    if (c.referralBonusAmount !== undefined)
      meta.referralBonusAmount = c.referralBonusAmount;
    name = `${name} [meta:${JSON.stringify(meta)}]`.trim();
  }
  if (name)
    row.nome = name;
  if (c.phone || c.whatsapp) {
    row.telefone = (c.phone || c.whatsapp).replace(/\D/g, "");
  }
  if (c.birthDate)
    row.data_aniversario = c.birthDate;
  return row;
}
function mapDbUserToFrontend(row) {
  let permissions = undefined;
  if (row.permissions !== undefined && row.permissions !== null) {
    try {
      const parsed = typeof row.permissions === "string" ? JSON.parse(row.permissions) : row.permissions;
      if (parsed && typeof parsed === "object") {
        permissions = parsed;
      }
    } catch (e) {
      console.warn("Erro ao ler JSON de permissões:", e);
    }
  }
  if (permissions === undefined) {
    const roleKey = row.perfil || "tecnico";
    permissions = DEFAULT_ROLE_PERMISSIONS[roleKey] || DEFAULT_ROLE_PERMISSIONS.tecnico;
  }
  let commissions = [];
  if (row.commissions) {
    try {
      commissions = typeof row.commissions === "string" ? JSON.parse(row.commissions) : row.commissions;
    } catch (e) {
      console.warn("Erro ao ler JSON de comissões:", e);
    }
  }
  return {
    id: row.id,
    authUserId: row.auth_user_id || undefined,
    name: row.nome || row.name || "Usuário",
    phone: row.telefone || row.phone || "",
    email: row.email || "",
    status: row.status || "ativo",
    role: row.perfil || "tecnico",
    photoUrl: row.foto_url || row.photo_url || "",
    permissions,
    commissions,
    defaultCommissionPercent: row.default_commission_percent !== undefined ? Number(row.default_commission_percent) : 10,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}
function getVehiclePorte(brand, model) {
  if (!brand || !model)
    return "Médio";
  const b = brand.trim().toLowerCase();
  const m = model.trim().toLowerCase();
  let found = PREFILLED_VEHICLE_MODELS.find((item) => item.manufacturer.toLowerCase() === b && item.model.toLowerCase() === m);
  if (!found && !isServer) {
    try {
      const cached = localStorage.getItem("sl_vehicle_models");
      if (cached) {
        const list = JSON.parse(cached);
        found = list.find((item) => item.manufacturer.toLowerCase() === b && item.model.toLowerCase() === m);
      }
    } catch (e) {}
  }
  if (found) {
    if (found.size_category === "P")
      return "Pequeno";
    if (found.size_category === "G")
      return "Grande";
  }
  return "Médio";
}
function mapDbVehicleToFrontend(row) {
  let model = row.modelo || "Sem Modelo";
  let version = "";
  let year = "";
  let mileage = "";
  let isPrincipal = false;
  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = model.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.version)
        version = meta.version;
      if (meta.year)
        year = meta.year;
      if (meta.mileage)
        mileage = meta.mileage;
      if (meta.isPrincipal !== undefined)
        isPrincipal = !!meta.isPrincipal;
      model = model.replace(metaRegex, "").trim();
    } catch (e) {
      console.error("Erro ao fazer o parse do metadata do veículo:", e);
    }
  }
  let porteVal = "Médio";
  if (row.porte === "Pequeno" || row.porte === "Médio" || row.porte === "Grande") {
    porteVal = row.porte;
  } else {
    porteVal = getVehiclePorte(row.marca || "", model);
  }
  return {
    id: row.id,
    customerId: row.cliente_id || "",
    brand: row.marca || "Sem Marca",
    model,
    version,
    year,
    plate: row.plate || row.placa || "",
    color: row.cor || "Sem Cor",
    mileage,
    porte: porteVal,
    isPrincipal
  };
}
function mapFrontendVehicleToDb(v) {
  const row = {};
  if (v.id)
    row.id = v.id;
  if (v.customerId)
    row.cliente_id = v.customerId;
  if (v.brand)
    row.marca = v.brand;
  let model = v.model || "";
  const hasExtra = v.version || v.year || v.mileage || v.isPrincipal !== undefined;
  if (hasExtra && model) {
    const meta = {};
    if (v.version)
      meta.version = v.version;
    if (v.year)
      meta.year = v.year;
    if (v.mileage)
      meta.mileage = v.mileage;
    if (v.isPrincipal !== undefined)
      meta.isPrincipal = v.isPrincipal;
    model = `${model} [meta:${JSON.stringify(meta)}]`.trim();
  }
  if (model)
    row.modelo = model;
  if (v.plate) {
    row.placa = v.plate;
  }
  if (v.color)
    row.cor = v.color;
  row.porte = v.porte || getVehiclePorte(v.brand || "", v.model || "");
  return row;
}
function mapDbServiceToFrontend(row) {
  let basePrice = 150;
  let estimatedTime = 120;
  let description = row.observacao || "";
  let pricingType = "unico";
  let priceP;
  let priceM;
  let priceG;
  let isFeatured = false;
  let offerText = "";
  let displayOrder = 0;
  let portalVisibility = "lista";
  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = description.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.price !== undefined)
        basePrice = Number(meta.price);
      if (meta.time !== undefined)
        estimatedTime = Number(meta.time);
      if (meta.pricingType !== undefined)
        pricingType = meta.pricingType;
      if (meta.priceP !== undefined)
        priceP = Number(meta.priceP);
      if (meta.priceM !== undefined)
        priceM = Number(meta.priceM);
      if (meta.priceG !== undefined)
        priceG = Number(meta.priceG);
      if (meta.isFeatured !== undefined)
        isFeatured = Boolean(meta.isFeatured);
      if (meta.offerText !== undefined)
        offerText = String(meta.offerText);
      if (meta.displayOrder !== undefined)
        displayOrder = Number(meta.displayOrder);
      if (meta.portalVisibility !== undefined) {
        portalVisibility = meta.portalVisibility;
      } else if (isFeatured) {
        portalVisibility = "sugestao";
      }
      description = description.replace(metaRegex, "").trim();
    } catch (e) {
      console.error("Erro ao fazer o parse do metadata do serviço:", e);
    }
  }
  return {
    id: row.id,
    name: row.nome_servico || "Sem Nome",
    description,
    basePrice,
    estimatedTime,
    pricingType,
    priceP: priceP ?? basePrice,
    priceM: priceM ?? basePrice,
    priceG: priceG ?? basePrice,
    isFeatured: isFeatured || portalVisibility === "sugestao",
    offerText,
    displayOrder,
    portalVisibility
  };
}
function mapFrontendServiceToDb(s) {
  const row = {};
  if (s.id)
    row.id = s.id;
  if (s.name)
    row.nome_servico = s.name;
  let obs = s.description || "";
  const portalVisibility = s.portalVisibility ?? (s.isFeatured ? "sugestao" : "lista");
  const meta = {
    price: s.basePrice ?? 150,
    time: s.estimatedTime ?? 120,
    pricingType: s.pricingType ?? "unico",
    priceP: s.priceP ?? s.basePrice ?? 150,
    priceM: s.priceM ?? s.basePrice ?? 150,
    priceG: s.priceG ?? s.basePrice ?? 150,
    isFeatured: s.isFeatured ?? portalVisibility === "sugestao",
    offerText: s.offerText ?? "",
    displayOrder: s.displayOrder ?? 0,
    portalVisibility
  };
  obs = `${obs} [meta:${JSON.stringify(meta)}]`.trim();
  row.observacao = obs;
  row.ativo = true;
  row.categoria = "Estética";
  return row;
}
function mapDbAppointmentToFrontend(row) {
  let status = "agendado";
  const dbStatus = (row.status || "").toLowerCase();
  if (dbStatus === "agendado") {
    status = "agendado";
  } else if (dbStatus === "confirmado") {
    status = "confirmado";
  } else if (dbStatus === "em andamento" || dbStatus === "em_andamento") {
    status = "em_andamento";
  } else if (dbStatus === "concluído" || dbStatus === "concluido" || dbStatus === "finalizado" || dbStatus === "entregue") {
    status = "finalizado";
  } else if (dbStatus === "cancelado") {
    status = "cancelado";
  } else if (dbStatus === "cliente_chegou") {
    status = "cliente_chegou";
  } else if (["agendado", "confirmado", "em_andamento", "finalizado", "cancelado"].includes(dbStatus)) {
    status = dbStatus;
  }
  const dateStr = row.data_agendamento || getCurrentDateStr();
  const timeStr = row.hora_agendamento ? row.hora_agendamento.slice(0, 5) : "09:00";
  const dateTime = `${dateStr}T${timeStr}`;
  let notes = row.observacoes || "";
  let employeeId = "Gabriel";
  let discount = 0;
  let addition = 0;
  let serviceIds = [row.servico_id || ""];
  let startedAt = undefined;
  let concludedAt = undefined;
  let reminderSent = false;
  const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
  const match = notes.match(metaRegex);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      if (meta.employeeId)
        employeeId = meta.employeeId;
      if (meta.discount !== undefined)
        discount = Number(meta.discount);
      if (meta.addition !== undefined)
        addition = Number(meta.addition);
      if (meta.serviceIds)
        serviceIds = meta.serviceIds;
      if (meta.startedAt)
        startedAt = meta.startedAt;
      if (meta.concludedAt)
        concludedAt = meta.concludedAt;
      if (meta.reminderSent !== undefined)
        reminderSent = !!meta.reminderSent;
      notes = notes.replace(metaRegex, "").trim();
    } catch (e) {
      console.error("Erro ao fazer o parse do metadata do agendamento:", e);
    }
  }
  return {
    id: row.id,
    customerId: row.cliente_id || "",
    vehicleId: row.veiculo_id || "",
    serviceId: row.servico_id || "",
    serviceIds,
    dateTime,
    status,
    value: Number(row.valor_servico) || 0,
    durationTotal: Number(row.tempo_real) || 120,
    employeeId,
    discount,
    addition,
    notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt,
    concludedAt,
    reminderSent
  };
}
function mapFrontendAppointmentToDb(a) {
  const row = {};
  if (a.id)
    row.id = a.id;
  if (a.customerId)
    row.cliente_id = a.customerId;
  if (a.vehicleId)
    row.veiculo_id = a.vehicleId;
  if (a.serviceId)
    row.servico_id = a.serviceId;
  if (a.dateTime) {
    const parts = a.dateTime.split("T");
    row.data_agendamento = parts[0];
    if (parts[1]) {
      row.hora_agendamento = parts[1].slice(0, 5) + ":00";
    }
  }
  if (a.status) {
    if (a.status === "finalizado" || a.status === "entregue") {
      row.status = "Concluído";
    } else if (a.status === "em_andamento" || a.status === "cliente_chegou" || a.status === "aguardando_aprovacao" || a.status === "aguardando_peca") {
      row.status = "Em andamento";
    } else {
      const capitalizedStatus = a.status.charAt(0).toUpperCase() + a.status.slice(1).toLowerCase();
      row.status = capitalizedStatus;
    }
  }
  if (a.value !== undefined)
    row.valor_servico = a.value;
  if (a.durationTotal !== undefined)
    row.tempo_real = a.durationTotal;
  let notes = a.notes || "";
  const hasExtra = a.employeeId || a.discount !== undefined || a.addition !== undefined || a.serviceIds || a.startedAt || a.concludedAt || a.reminderSent !== undefined;
  if (hasExtra) {
    const meta = {};
    if (a.employeeId)
      meta.employeeId = a.employeeId;
    if (a.discount !== undefined)
      meta.discount = a.discount;
    if (a.addition !== undefined)
      meta.addition = a.addition;
    if (a.serviceIds)
      meta.serviceIds = a.serviceIds;
    if (a.startedAt)
      meta.startedAt = a.startedAt;
    if (a.concludedAt)
      meta.concludedAt = a.concludedAt;
    if (a.reminderSent !== undefined)
      meta.reminderSent = a.reminderSent;
    notes = `${notes} [meta:${JSON.stringify(meta)}]`.trim();
  }
  row.observacoes = notes;
  return row;
}

class LocalDatabase {
  customers = [];
  vehicles = [];
  services = [];
  appointments = [];
  history = [];
  finances = [];
  config = DEFAULT_CONFIG;
  automations = [];
  logs = [];
  vehicleModels = [];
  executions = [];
  users = [];
  commissions = [];
  onSyncCallback = null;
  constructor() {
    this.init();
  }
  init() {
    this.customers = getLocalData(KEYS.CUSTOMERS, DEFAULT_CUSTOMERS);
    this.vehicles = getLocalData(KEYS.VEHICLES, DEFAULT_VEHICLES);
    this.services = getLocalData(KEYS.SERVICES, DEFAULT_SERVICES);
    this.appointments = getLocalData(KEYS.APPOINTMENTS, DEFAULT_APPOINTMENTS);
    this.history = getLocalData(KEYS.HISTORY, []);
    this.finances = getLocalData(KEYS.FINANCES, []);
    this.executions = getLocalData("sl_executions", []);
    this.users = getLocalData(KEYS.USERS, DEFAULT_USERS).map(({ password: _legacyPassword, ...user }) => user);
    setLocalData(KEYS.USERS, this.users);
    this.commissions = getLocalData(KEYS.COMMISSIONS, []);
    const legacyConfig = typeof localStorage !== "undefined" ? localStorage.getItem(KEYS.CONFIG) : null;
    const legacyAutomations = typeof localStorage !== "undefined" ? localStorage.getItem(KEYS.AUTOMATIONS) : null;
    let savedConfig = DEFAULT_CONFIG;
    if (legacyConfig) {
      try {
        savedConfig = JSON.parse(legacyConfig);
      } catch (e) {}
    } else {
      savedConfig = getLocalData("sl_config_cache", DEFAULT_CONFIG);
    }
    this.config = { ...DEFAULT_CONFIG, ...savedConfig };
    let savedAutomations = DEFAULT_AUTOMATIONS;
    if (legacyAutomations) {
      try {
        savedAutomations = JSON.parse(legacyAutomations);
      } catch (e) {}
    } else {
      savedAutomations = getLocalData("sl_automations_cache", DEFAULT_AUTOMATIONS);
    }
    this.automations = savedAutomations;
    this.ensureAllDefaultAutomationsExist();
    this.logs = getLocalData(KEYS.LOGS, []);
    this.vehicleModels = getLocalData(KEYS.VEHICLE_MODELS, PREFILLED_VEHICLE_MODELS);
    this.recalculateCommissions();
    if (this.config.useRealSupabase) {
      this.syncWithSupabase();
    }
  }
  save() {
    setLocalData(KEYS.CUSTOMERS, this.customers);
    setLocalData(KEYS.VEHICLES, this.vehicles);
    setLocalData(KEYS.SERVICES, this.services);
    setLocalData(KEYS.APPOINTMENTS, this.appointments);
    setLocalData(KEYS.HISTORY, this.history);
    setLocalData(KEYS.FINANCES, this.finances);
    setLocalData("sl_config_cache", this.config);
    setLocalData("sl_automations_cache", this.automations);
    setLocalData(KEYS.LOGS, this.logs);
    setLocalData(KEYS.VEHICLE_MODELS, this.vehicleModels);
    setLocalData("sl_executions", this.executions);
    const usersWithoutPasswords = this.users.map((user) => {
      const { password: _legacyPassword, ...safeUser } = user;
      return safeUser;
    });
    setLocalData(KEYS.USERS, usersWithoutPasswords);
    setLocalData(KEYS.COMMISSIONS, this.commissions);
  }
  ensureAllDefaultAutomationsExist() {
    if (!Array.isArray(this.automations)) {
      this.automations = [];
    }
    let updated = false;
    for (const defaultAuto of DEFAULT_AUTOMATIONS) {
      const exists = this.automations.some((a) => a && a.event === defaultAuto.event);
      if (!exists) {
        console.log(`[Automation Restore] Restoring missing automation for event: ${defaultAuto.event}`);
        this.automations.push({ ...defaultAuto });
        updated = true;
      }
    }
    if (updated) {
      this.save();
      if (this.config.useRealSupabase) {
        this.saveConfigToSupabase().catch((e) => {
          console.error("[Automation Restore] Error syncing restored automations to Supabase:", e);
        });
      }
    }
  }
  getSupabaseClient() {
    return getSharedSupabaseClient(this.config.supabaseUrl, this.config.supabaseAnonKey);
  }
  async loadConfigFromSupabase(supabase) {
    try {
      console.log('[Supabase Config] Tentando carregar configurações da tabela central "configuracoes_empresa"...');
      const { data, error } = await supabase.from("configuracoes_empresa").select("*").eq("id", "c0000000-0000-0000-0000-000000000000").single();
      if (!error && data) {
        console.log("[Supabase Config] Configurações administrativas carregadas com sucesso da tabela central.");
        this.config = {
          ...this.config,
          companyName: data.company_name || this.config.companyName,
          phone: data.phone || this.config.phone,
          email: data.email || this.config.email,
          cnpj: data.cnpj || this.config.cnpj,
          address: data.address || this.config.address,
          hoursOfOperation: data.hours_of_operation || this.config.hoursOfOperation,
          logoUrl: data.logo_url || this.config.logoUrl,
          primaryColor: data.primary_color || this.config.primaryColor,
          accentColor: data.accent_color || this.config.accentColor,
          zapiInstanceId: data.zapi_instance_id || this.config.zapiInstanceId,
          zapiToken: data.zapi_token || this.config.zapiToken,
          makeWebhookUrl: data.make_webhook_url || this.config.makeWebhookUrl,
          referralActive: data.referral_active !== undefined ? data.referral_active : this.config.referralActive,
          referralDiscountPercent: data.referral_discount_percent !== undefined ? data.referral_discount_percent : this.config.referralDiscountPercent,
          agenda: data.agenda ? typeof data.agenda === "string" ? JSON.parse(data.agenda) : data.agenda : this.config.agenda
        };
        if (data.automations) {
          const parsedAutomations = typeof data.automations === "string" ? JSON.parse(data.automations) : data.automations;
          if (Array.isArray(parsedAutomations) && parsedAutomations.length > 0) {
            this.automations = parsedAutomations;
          }
        }
        this.ensureAllDefaultAutomationsExist();
        if (!isServer) {
          localStorage.removeItem(KEYS.CONFIG);
          localStorage.removeItem(KEYS.AUTOMATIONS);
        }
        return true;
      } else {
        if (error && (error.code === "PGRST205" || error.message?.includes("does not exist") || error.code === "42P01")) {
          console.log('[Supabase Config] Tabela "configuracoes_empresa" não encontrada. Utilizando fallback seguro na tabela "clientes"...');
          const { data: fallbackData, error: fallbackError } = await supabase.from("clientes").select("nome").eq("id", "c0000000-0000-0000-0000-000000000000").maybeSingle();
          if (!fallbackError && fallbackData && fallbackData.nome) {
            const metaRegex = /\[meta:([\s\S]*?)\]\s*$/;
            const match = fallbackData.nome.match(metaRegex);
            if (match) {
              try {
                const parsed = JSON.parse(match[1]);
                if (parsed.config) {
                  this.config = { ...this.config, ...parsed.config };
                }
                if (parsed.automations && Array.isArray(parsed.automations)) {
                  this.automations = parsed.automations;
                }
                this.ensureAllDefaultAutomationsExist();
                console.log('[Supabase Config] Configurações administrativas carregadas do fallback da tabela "clientes" com sucesso.');
                if (!isServer) {
                  localStorage.removeItem(KEYS.CONFIG);
                  localStorage.removeItem(KEYS.AUTOMATIONS);
                }
                return true;
              } catch (parseErr) {
                console.error("[Supabase Config Error] Falha ao fazer parse do fallback no campo nome:", parseErr);
              }
            }
          }
        } else {
          console.warn("[Supabase Config] Erro ao carregar configurações administrativas do Supabase:", error);
        }
      }
    } catch (err) {
      console.error("[Supabase Config Error] Erro inesperado ao carregar configurações administrativas:", err);
    }
    await this.migrateLocalConfigToSupabase(supabase);
    return false;
  }
  async migrateLocalConfigToSupabase(supabase) {
    const legacyConfig = !isServer ? localStorage.getItem(KEYS.CONFIG) : null;
    const legacyAutomations = !isServer ? localStorage.getItem(KEYS.AUTOMATIONS) : null;
    if (legacyConfig || legacyAutomations) {
      console.log("[Supabase Config Migration] Configurações antigas encontradas no LocalStorage. Iniciando migração automática para o Supabase...");
      const success = await this.saveConfigToSupabase(supabase);
      if (success && !isServer) {
        console.log("[Supabase Config Migration] Migração concluída com sucesso! Removendo dados legados do LocalStorage...");
        localStorage.removeItem(KEYS.CONFIG);
        localStorage.removeItem(KEYS.AUTOMATIONS);
      }
    } else {
      console.log("[Supabase Config] Nenhuma configuração local encontrada. Gravando configurações padrão no Supabase...");
      await this.saveConfigToSupabase(supabase);
    }
  }
  async saveConfigToSupabase(supabaseClient) {
    if (!this.config.useRealSupabase)
      return false;
    try {
      const supabase = supabaseClient || this.getSupabaseClient();
      console.log("[Supabase Config] Salvando configurações centralizadas no Supabase...");
      const { error } = await supabase.from("configuracoes_empresa").upsert({
        id: "c0000000-0000-0000-0000-000000000000",
        company_name: this.config.companyName,
        phone: this.config.phone,
        email: this.config.email,
        cnpj: this.config.cnpj,
        address: this.config.address,
        hours_of_operation: this.config.hoursOfOperation,
        logo_url: this.config.logoUrl,
        primary_color: this.config.primaryColor,
        accent_color: this.config.accentColor,
        zapi_instance_id: this.config.zapiInstanceId,
        zapi_token: this.config.zapiToken,
        make_webhook_url: this.config.makeWebhookUrl,
        referral_active: this.config.referralActive ?? true,
        referral_discount_percent: this.config.referralDiscountPercent ?? 10,
        agenda: this.config.agenda ? JSON.stringify(this.config.agenda) : undefined,
        automations: this.automations,
        updated_at: new Date().toISOString()
      });
      if (!error) {
        console.log('[Supabase Config] Configurações centralizadas salvas com sucesso em "configuracoes_empresa".');
        return true;
      }
      if (error && (error.code === "PGRST205" || error.message?.includes("does not exist") || error.code === "42P01")) {
        console.log('[Supabase Config] Tabela "configuracoes_empresa" não existe. Salvando fallback na tabela "clientes"...');
        const payload = {
          config: {
            companyName: this.config.companyName,
            phone: this.config.phone,
            email: this.config.email,
            cnpj: this.config.cnpj,
            address: this.config.address,
            hoursOfOperation: this.config.hoursOfOperation,
            logoUrl: this.config.logoUrl,
            primaryColor: this.config.primaryColor,
            accentColor: this.config.accentColor,
            zapiInstanceId: this.config.zapiInstanceId,
            zapiToken: this.config.zapiToken,
            makeWebhookUrl: this.config.makeWebhookUrl,
            referralActive: this.config.referralActive,
            referralDiscountPercent: this.config.referralDiscountPercent,
            agenda: this.config.agenda
          },
          automations: this.automations
        };
        const { error: fallbackError } = await supabase.from("clientes").upsert({
          id: "c0000000-0000-0000-0000-000000000000",
          nome: `Configurações Gerais do Sistema [meta:${JSON.stringify(payload)}]`,
          telefone: "00000000000"
        });
        if (!fallbackError) {
          console.log('[Supabase Config] Configurações salvas no fallback da tabela "clientes" com sucesso.');
          return true;
        } else {
          console.error('[Supabase Config Error] Falha ao salvar no fallback de "clientes":', fallbackError);
        }
      } else {
        console.error('[Supabase Config Error] Falha ao salvar em "configuracoes_empresa":', error);
      }
    } catch (err) {
      console.error("[Supabase Config Error] Erro inesperado ao salvar configurações centralizadas:", err);
    }
    return false;
  }
  async syncWithSupabase() {
    if (!this.config.useRealSupabase) {
      console.log("[Supabase Sync] Sincronização desativada (useRealSupabase: false)");
      return;
    }
    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      console.warn("[Supabase Sync] Sincronização ignorada: URL ou Chave Anon do Supabase faltando.");
      return;
    }
    console.log(`[Supabase Sync] Iniciando sincronização. URL: ${this.config.supabaseUrl} | Key: ${this.config.supabaseAnonKey.slice(0, 10)}...`);
    try {
      const supabase = this.getSupabaseClient();
      await this.loadConfigFromSupabase(supabase);
      console.log('[Supabase Sync] Buscando clientes da tabela "clientes"...');
      const { data: dbClientes, error: errClientes } = await supabase.from("clientes").select("*");
      if (errClientes) {
        console.error("[Supabase Sync Error] Erro ao buscar clientes do Supabase:", errClientes);
      } else if (dbClientes) {
        console.log(`[Supabase Sync] Sucesso: ${dbClientes.length} registros brutos de clientes retornados do Supabase.`);
        this.customers = dbClientes.filter((row) => row.id !== "c0000000-0000-0000-0000-000000000000").map(mapDbCustomerToFrontend);
        this.customers.forEach((customer) => {
          if (customer.referralCode) {
            console.log(`[Referral Audit] Stage 3 (Leitura): Código "${customer.referralCode}" decodificado para o cliente "${customer.name}".`);
          } else {
            console.log(`[Referral Audit] Stage 3 (Leitura): Cliente "${customer.name}" carregado, mas sem código de indicação.`);
          }
        });
        let updatedAny = false;
        for (const customer of this.customers) {
          if (!customer.referralCode) {
            console.log(`[Referral Audit] Stage 1 (Geração) - Sincronização: Cliente antigo/existente "${customer.name}" não possui código de indicação no metadata. Gerando novo código...`);
            const generatedCode = generateReferralCode(this.customers);
            customer.referralCode = generatedCode;
            customer.referralDiscountAvailable = customer.referralDiscountAvailable ?? false;
            customer.referralDiscountUsed = customer.referralDiscountUsed ?? false;
            customer.referralCreatedAt = customer.referralCreatedAt || new Date().toISOString().split("T")[0];
            console.log(`[Referral Audit] Stage 2 (Gravação) - Sincronização: Gravando código gerado "${customer.referralCode}" para o cliente "${customer.name}" no Supabase...`);
            try {
              const mapped = mapFrontendCustomerToDb(customer);
              const { error: errUpdate } = await supabase.from("clientes").update(mapped).eq("id", customer.id);
              if (errUpdate) {
                console.error(`[Referral Audit] Erro ao atualizar código no Supabase para "${customer.name}":`, errUpdate);
              } else {
                console.log(`[Referral Audit] Stage 2 (Gravação) - Sincronização: Gravado com sucesso no Supabase para "${customer.name}"`);
              }
            } catch (err) {
              console.error("[Referral Audit] Erro inesperado ao salvar código gerado para cliente antigo no Supabase:", err);
            }
            updatedAny = true;
          }
        }
        if (updatedAny) {
          this.save();
        }
      }
      console.log('[Supabase Sync] Buscando veículos da tabela "veiculos"...');
      const { data: dbVeiculos, error: errVeiculos } = await supabase.from("veiculos").select("*");
      if (errVeiculos) {
        console.error("[Supabase Sync Error] Erro ao buscar veículos do Supabase:", errVeiculos);
      } else if (dbVeiculos) {
        console.log(`[Supabase Sync] Sucesso: ${dbVeiculos.length} registros de veículos retornados.`);
        this.vehicles = dbVeiculos.map(mapDbVehicleToFrontend);
      }
      console.log('[Supabase Sync] Buscando serviços da tabela "servicos_disponiveis"...');
      const { data: dbServicos, error: errServicos } = await supabase.from("servicos_disponiveis").select("*");
      if (errServicos) {
        console.error("[Supabase Sync Error] Erro ao buscar serviços do Supabase:", errServicos);
      } else if (dbServicos) {
        console.log(`[Supabase Sync] Sucesso: ${dbServicos.length} registros de serviços retornados.`);
        this.services = dbServicos.map(mapDbServiceToFrontend);
      }
      console.log('[Supabase Sync] Buscando agendamentos da tabela "agendamentos"...');
      const { data: dbAgendamentos, error: errAgendamentos } = await supabase.from("agendamentos").select("*");
      if (errAgendamentos) {
        console.error("[Supabase Sync Error] Erro ao buscar agendamentos do Supabase:", errAgendamentos);
      } else if (dbAgendamentos) {
        console.log(`[Supabase Sync] Sucesso: ${dbAgendamentos.length} registros de agendamentos retornados.`);
        this.appointments = dbAgendamentos.map(mapDbAppointmentToFrontend);
      }
      try {
        console.log('[Supabase Sync] Buscando execuções de automações da tabela "automacoes_execucoes"...');
        const { data: dbExecucoes, error: errExecucoes } = await supabase.from("automacoes_execucoes").select("*");
        if (dbExecucoes && !errExecucoes) {
          console.log(`[Supabase Sync] Sucesso: ${dbExecucoes.length} registros de execuções de automações retornados.`);
          this.executions = dbExecucoes.map((row) => ({
            id: row.id,
            empresa_id: row.empresa_id || "c0000000-0000-0000-0000-000000000000",
            automacao: row.automacao || "",
            appointment_id: row.appointment_id || undefined,
            customer_id: row.customer_id || "",
            telefone: row.telefone || "",
            mensagem: row.mensagem || "",
            status: row.status || "pendente",
            tentativas: row.tentativas !== undefined ? row.tentativas : 1,
            resposta_api: row.resposta_api || undefined,
            data_execucao: row.data_execucao || new Date().toISOString(),
            data_proxima_tentativa: row.data_proxima_tentativa || undefined,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: row.updated_at || new Date().toISOString()
          }));
        } else if (errExecucoes) {
          console.log('[Supabase Sync Cache] Tabela "automacoes_execucoes" não encontrada ou falhou ao ler do Supabase. Usando cache local.', errExecucoes.message);
        }
      } catch (e) {
        console.warn('Erro ao ler tabela "automacoes_execucoes" do Supabase. Usando cache local.', e.message);
      }
      try {
        const { data: dbModelos, error: errModelos } = await supabase.from("vehicle_models").select("*");
        if (dbModelos && !errModelos) {
          this.vehicleModels = dbModelos.map((row) => ({
            id: row.id,
            manufacturer: row.manufacturer || "",
            model: row.model || "",
            size_category: row.size_category || "M",
            active: row.active !== undefined ? row.active : true,
            created_at: row.created_at,
            updated_at: row.updated_at
          }));
        } else if (errModelos) {
          console.warn("Tabela vehicle_models não encontrada no Supabase. Utilizando modelos em cache local.", errModelos.message);
        }
      } catch (e) {
        console.warn("Erro ao ler tabela vehicle_models do Supabase. Utilizando modelos em cache local.", e.message);
      }
      try {
        console.log('[Supabase Sync] Buscando usuários da tabela "usuarios"...');
        const { data: dbUsuarios, error: errUsuarios } = await supabase.from("usuarios").select("*");
        if (dbUsuarios && !errUsuarios) {
          console.log(`[Supabase Sync] Sucesso: ${dbUsuarios.length} registros de usuários retornados do Supabase.`);
          this.users = dbUsuarios.map(mapDbUserToFrontend);
        } else if (errUsuarios) {
          console.warn('[Supabase Sync] Tabela "usuarios" não encontrada ou erro ao ler do Supabase:', errUsuarios.message);
        }
      } catch (e) {
        console.warn('Erro ao ler tabela "usuarios" do Supabase:', e.message);
      }
      this.history = this.appointments.filter((a) => a.status === "finalizado" || a.status === "entregue").map((appt) => {
        const customer = this.customers.find((c) => c.id === appt.customerId);
        const vehicle = this.vehicles.find((v) => v.id === appt.vehicleId);
        const service = this.services.find((s) => s.id === appt.serviceId);
        return {
          id: "h_" + appt.id,
          appointmentId: appt.id,
          customerId: appt.customerId,
          customerName: customer ? customer.name : "Cliente Estética",
          vehicleId: appt.vehicleId,
          vehicleDetails: vehicle ? `${vehicle.brand} ${vehicle.model} [${vehicle.plate}]` : "Veículo Estética",
          serviceId: appt.serviceId,
          serviceName: service ? service.name : "Serviço Estética",
          value: appt.value,
          date: appt.dateTime.split("T")[0],
          notes: appt.notes || "Serviço finalizado com sucesso.",
          timeSpent: appt.durationTotal || 120,
          employeeResponsible: appt.employeeId || "Gabriel"
        };
      });
      const localExpenses = this.finances.filter((t) => t.type === "despesa");
      const derivedRevenues = this.appointments.filter((a) => a.status === "finalizado" || a.status === "entregue").map((appt) => {
        const customer = this.customers.find((c) => c.id === appt.customerId);
        const service = this.services.find((s) => s.id === appt.serviceId);
        return {
          id: "t_rev_" + appt.id,
          type: "receita",
          category: "Serviço",
          amount: appt.value,
          date: appt.dateTime.split("T")[0],
          description: `Serviço ${service?.name || "Automotivo"} - ${customer?.name || "Cliente"}`,
          status: "pago"
        };
      });
      this.finances = [...derivedRevenues, ...localExpenses];
      this.save();
      if (this.onSyncCallback) {
        this.onSyncCallback();
      }
    } catch (e) {
      console.error("Falha ao sincronizar com Supabase:", e);
    }
  }
  triggerAutomation(event, context) {
    const automation = this.automations.find((a) => a.event === event);
    if (!automation || !automation.isActive) {
      console.log(`[Automation Trigger] Evento "${event}" ignorado. Automação não encontrada ou inativa.`);
      return;
    }
    const normalizedText = renderAndNormalizeMessage(automation.template, context);
    const payloadBody = {
      event,
      customer: context.customer,
      vehicle: context.vehicle,
      service: context.service,
      appointment: context.appointment,
      formattedMessage: normalizedText
    };
    console.log(`[Automation Trigger] Evento: ${event} | Alvo: ${context.customer.name}`);
    console.log(`[Automation Trigger] Webhook URL Configurada: ${this.config.makeWebhookUrl || "Nenhuma"}`);
    const validation = validatePayload(payloadBody);
    if (!validation.valid) {
      console.error(`[Automation Validation Failure] Falha de validação de payload JSON: ${validation.error}`);
    } else {
      console.log(`[Automation Validation Success] Payload JSON validado com sucesso! Sem caracteres de controle que invalidariam a string.`);
    }
    const newLog = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      triggerEvent: automation.name,
      targetName: context.customer.name,
      targetContact: context.customer.phone || context.customer.whatsapp,
      payload: `Mensagem Original:
${automation.template}

Mensagem Normalizada:
${normalizedText}

Status de Validação: ${validation.valid ? "Sucesso" : "Erro (" + validation.error + ")"}`,
      status: "simulado",
      timestamp: new Date().toISOString()
    };
    if (this.config.makeWebhookUrl) {
      const webhookUrl = this.config.makeWebhookUrl;
      console.log(`[Webhook Make] Payload enviado ao Make (URL: ${webhookUrl}):`, JSON.stringify(payloadBody, null, 2));
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody)
      }).then(async (response) => {
        const responseText = await response.text();
        console.log(`[Webhook Make] Payload recebido pelo Make (Resposta). Status: ${response.status} | Body: ${responseText}`);
        if (response.ok) {
          newLog.status = "sucesso";
          newLog.payload += `

[Webhook Enviado com Sucesso!]
URL: ${webhookUrl}
Payload: ${JSON.stringify(payloadBody, null, 2)}
Resposta: ${response.status} - ${responseText}`;
        } else {
          newLog.status = "erro";
          newLog.payload += `

[Erro Webhook Make: Código de status ${response.status}]
URL: ${webhookUrl}
Payload: ${JSON.stringify(payloadBody, null, 2)}
Resposta: ${responseText}`;
        }
        this.addLog(newLog);
      }).catch((e) => {
        console.error(`[Webhook Make Error] Falha ao disparar fetch para ${webhookUrl}:`, e);
        newLog.status = "erro";
        newLog.payload += `

[Erro de Rede Webhook Make: ${e.message}]
URL: ${webhookUrl}
Payload: ${JSON.stringify(payloadBody, null, 2)}`;
        this.addLog(newLog);
      });
    } else {
      console.log(`[Webhook Make] Nenhum webhook configurado. Log registrado como simulado.`);
      this.addLog(newLog);
    }
    if (this.config.zapiInstanceId && this.config.zapiToken) {
      const zapiUrl = `https://api.z-api.io/instances/${this.config.zapiInstanceId}/token/${this.config.zapiToken}/send-text`;
      const zapiPayload = {
        phone: context.customer.whatsapp || context.customer.phone,
        message: normalizedText
      };
      console.log(`[Z-API] Payload enviado para a Z-API (URL: ${zapiUrl}):`, JSON.stringify(zapiPayload, null, 2));
      const headers = { "Content-Type": "application/json" };
      if (this.config.zapiClientToken) {
        headers["Client-Token"] = this.config.zapiClientToken;
      }
      fetch(zapiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(zapiPayload)
      }).then(async (res) => {
        const resText = await res.text();
        console.log(`[Z-API] Payload recebido da Z-API (Resposta). Status: ${res.status} | Body: ${resText}`);
      }).catch((e) => {
        console.error("Error sending Z-API WhatsApp", e);
      });
    }
  }
  addLog(log) {
    this.logs.unshift(log);
    if (this.logs.length > 100)
      this.logs.pop();
    this.save();
  }
  validateReferralCode(code, currentCustomerId, currentCustomerPhone) {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, error: "Código de indicação em branco." };
    }
    const referrer = this.customers.find((c) => c.referralCode?.toUpperCase() === cleanCode);
    console.log(`[Referral Debug] ID do cliente atual: ${currentCustomerId || "Não definido (primeiro cadastro)"}, Telefone: ${currentCustomerPhone || "Não definido"}, Código informado: ${code}, ID do proprietário do código: ${referrer ? referrer.id : "Nenhum proprietário encontrado"}`);
    if (!referrer) {
      return { valid: false, error: "código de indicação inválido." };
    }
    if (currentCustomerId && referrer.id === currentCustomerId) {
      return { valid: false, error: "Você não pode utilizar seu próprio código de indicação." };
    }
    return { valid: true, referrer };
  }
  async addCustomer(customer) {
    const id = generateUUID();
    const clientSince = new Date().toISOString().split("T")[0];
    console.log(`[Referral Audit] Cadastro iniciado para o cliente: ${customer.name}`);
    const customerObjWithoutCode = {
      ...customer,
      id,
      clientSince,
      lastServiceDate: null,
      referralDiscountAvailable: customer.referralDiscountAvailable ?? false,
      referralDiscountUsed: customer.referralDiscountUsed ?? false,
      referralCreatedAt: customer.referralCreatedAt || clientSince
    };
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      console.log(`[Referral Audit] Salvando cliente no Supabase: ${customer.name}`);
      const { error } = await supabase.from("clientes").insert(mapFrontendCustomerToDb(customerObjWithoutCode));
      if (error) {
        console.error("[Referral Audit] Erro ao cadastrar cliente no Supabase:", error.message);
        throw error;
      }
      console.log(`[Referral Audit] Cliente salvo no Supabase com sucesso: ${customer.name}`);
    } else {
      console.log(`[Referral Audit] Cliente salvo localmente com sucesso: ${customer.name}`);
    }
    console.log(`[Referral Audit] Verificar se já existe referralCode para o cliente: ${customer.name}`);
    let referralCode = customer.referralCode || "";
    if (referralCode) {
      console.log(`[Referral Audit] Código existente: ${referralCode}`);
    } else {
      console.log(`[Referral Audit] Cliente sem código de indicação.`);
      referralCode = generateReferralCode(this.customers);
      console.log(`[Referral Audit] Código gerado: ${referralCode}`);
    }
    const finalCustomer = {
      ...customerObjWithoutCode,
      referralCode
    };
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      console.log(`[Referral Audit] Salvando definitivamente o código no Supabase para: ${customer.name}`);
      const { error } = await supabase.from("clientes").update(mapFrontendCustomerToDb(finalCustomer)).eq("id", id);
      if (error) {
        console.error("[Referral Audit] Erro ao gravar código definitivo no Supabase:", error.message);
        throw error;
      }
      console.log(`[Referral Audit] Código gravado com sucesso no Supabase: ${referralCode}`);
    } else {
      console.log(`[Referral Audit] Código gravado com sucesso no banco local: ${referralCode}`);
    }
    this.customers.push(finalCustomer);
    this.save();
    console.log(`[Referral Audit] Estado local atualizado com o novo cliente.`);
    this.triggerAutomation("novo_cliente", { customer: finalCustomer });
    return finalCustomer;
  }
  async updateCustomer(id, updated) {
    const existing = this.customers.find((c) => c.id === id);
    const fullCustomer = existing ? { ...existing, ...updated } : updated;
    console.log(`[Referral Audit] Stage 2 (Gravação): Atualizando dados do cliente "${fullCustomer.name || id}" no Supabase...`);
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const mapped = mapFrontendCustomerToDb(fullCustomer);
      const { error } = await supabase.from("clientes").update(mapped).eq("id", id);
      if (error) {
        console.error("[Referral Audit] Erro ao atualizar cliente no Supabase:", error.message);
        throw error;
      }
      console.log(`[Referral Audit] Stage 2 (Gravação): Cliente "${fullCustomer.name || id}" atualizado com sucesso no Supabase.`);
    }
    this.customers = this.customers.map((c) => c.id === id ? { ...c, ...updated } : c);
    this.save();
  }
  async deleteCustomer(id) {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      await supabase.from("agendamentos").delete().eq("cliente_id", id);
      await supabase.from("veiculos").delete().eq("cliente_id", id);
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) {
        console.error("Erro ao deletar cliente do Supabase:", error.message);
        throw error;
      }
    }
    this.customers = this.customers.filter((c) => c.id !== id);
    this.vehicles = this.vehicles.filter((v) => v.customerId !== id);
    this.appointments = this.appointments.filter((a) => a.customerId !== id);
    this.save();
  }
  async addVehicle(vehicle) {
    const id = generateUUID();
    const newVehicle = {
      ...vehicle,
      id
    };
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("veiculos").insert(mapFrontendVehicleToDb(newVehicle));
      if (error) {
        console.error("Erro ao salvar veículo no Supabase:", error.message);
        throw error;
      }
    }
    this.vehicles.push(newVehicle);
    this.save();
    return newVehicle;
  }
  async updateVehicle(id, updated) {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("veiculos").update(mapFrontendVehicleToDb(updated)).eq("id", id);
      if (error) {
        console.error("Erro ao atualizar veículo no Supabase:", error.message);
        throw error;
      }
    }
    this.vehicles = this.vehicles.map((v) => v.id === id ? { ...v, ...updated } : v);
    this.save();
  }
  async deleteVehicle(id) {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      await supabase.from("agendamentos").delete().eq("veiculo_id", id);
      const { error } = await supabase.from("veiculos").delete().eq("id", id);
      if (error) {
        console.error("Erro ao deletar veículo do Supabase:", error.message);
        throw error;
      }
    }
    this.vehicles = this.vehicles.filter((v) => v.id !== id);
    this.appointments = this.appointments.filter((a) => a.vehicleId !== id);
    this.save();
  }
  async addService(service) {
    const id = generateUUID();
    const newService = {
      ...service,
      id
    };
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("servicos_disponiveis").insert(mapFrontendServiceToDb(newService));
      if (error) {
        console.error("Erro ao cadastrar serviço no Supabase:", error.message);
        throw error;
      }
    }
    this.services.push(newService);
    this.save();
    return newService;
  }
  async updateService(id, updated) {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("servicos_disponiveis").update(mapFrontendServiceToDb(updated)).eq("id", id);
      if (error) {
        console.error("Erro ao atualizar serviço no Supabase:", error.message);
        throw error;
      }
    }
    this.services = this.services.map((s) => s.id === id ? { ...s, ...updated } : s);
    this.save();
  }
  async deleteService(id) {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      await supabase.from("agendamentos").delete().eq("servico_id", id);
      const { error } = await supabase.from("servicos_disponiveis").delete().eq("id", id);
      if (error) {
        console.error("Erro ao deletar serviço do Supabase:", error.message);
        throw error;
      }
    }
    this.services = this.services.filter((s) => s.id !== id);
    this.save();
  }
  async addAppointment(appointment) {
    const id = generateUUID();
    const newAppointment = {
      ...appointment,
      id
    };
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("agendamentos").insert(mapFrontendAppointmentToDb(newAppointment));
      if (error) {
        console.error("Erro ao criar agendamento no Supabase:", error.message);
        throw error;
      }
    }
    this.appointments.push(newAppointment);
    this.save();
    const customer = this.customers.find((c) => c.id === appointment.customerId);
    const vehicle = this.vehicles.find((v) => v.id === appointment.vehicleId);
    const service = this.services.find((s) => s.id === appointment.serviceId);
    if (customer) {
      this.triggerAutomation("novo_agendamento", { customer, vehicle, service, appointment: newAppointment });
    }
    return newAppointment;
  }
  async updateAppointmentStatus(id, status, notes) {
    const appointment = this.appointments.find((a) => a.id === id);
    if (!appointment)
      return;
    const oldStatus = appointment.status;
    appointment.status = status;
    if (notes !== undefined)
      appointment.notes = notes;
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("agendamentos").update(mapFrontendAppointmentToDb(appointment)).eq("id", id);
      if (error) {
        console.error("Erro ao atualizar status do agendamento no Supabase:", error.message);
        throw error;
      }
    }
    this.save();
    if (status === "confirmado" && oldStatus !== "confirmado") {
      const customer = this.customers.find((c) => c.id === appointment.customerId);
      const vehicle = this.vehicles.find((v) => v.id === appointment.vehicleId);
      const service = this.services.find((s) => s.id === appointment.serviceId);
      if (customer) {
        this.triggerAutomation("novo_agendamento", { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }
    if (status === "em_andamento" && oldStatus !== "em_andamento") {
      const customer = this.customers.find((c) => c.id === appointment.customerId);
      const vehicle = this.vehicles.find((v) => v.id === appointment.vehicleId);
      const service = this.services.find((s) => s.id === appointment.serviceId);
      if (customer) {
        this.triggerAutomation("servico_iniciado", { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }
    if ((status === "finalizado" || status === "entregue") && oldStatus !== "finalizado" && oldStatus !== "entregue") {
      const customer = this.customers.find((c) => c.id === appointment.customerId);
      const vehicle = this.vehicles.find((v) => v.id === appointment.vehicleId);
      const service = this.services.find((s) => s.id === appointment.serviceId);
      if (customer) {
        this.triggerAutomation("servico_finalizado", { customer, vehicle, service, appointment });
        this.triggerAutomation("pagamento_recebido", { customer, vehicle, service, appointment });
      }
      await this.checkAndReleaseReferralCredits(appointment.customerId);
      await this.syncWithSupabase();
    }
  }
  async updateAppointment(id, updated) {
    const appointment = this.appointments.find((a) => a.id === id);
    if (!appointment)
      return;
    const oldStatus = appointment.status;
    Object.assign(appointment, updated);
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("agendamentos").update(mapFrontendAppointmentToDb(appointment)).eq("id", id);
      if (error) {
        console.error("Erro ao atualizar agendamento no Supabase:", error.message);
        throw error;
      }
    }
    this.save();
    if (appointment.status === "confirmado" && oldStatus !== "confirmado") {
      const customer = this.customers.find((c) => c.id === appointment.customerId);
      const vehicle = this.vehicles.find((v) => v.id === appointment.vehicleId);
      const service = this.services.find((s) => s.id === appointment.serviceId);
      if (customer) {
        this.triggerAutomation("novo_agendamento", { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }
    if (appointment.status === "em_andamento" && oldStatus !== "em_andamento") {
      const customer = this.customers.find((c) => c.id === appointment.customerId);
      const vehicle = this.vehicles.find((v) => v.id === appointment.vehicleId);
      const service = this.services.find((s) => s.id === appointment.serviceId);
      if (customer) {
        this.triggerAutomation("servico_iniciado", { customer, vehicle, service, appointment });
      }
      await this.syncWithSupabase();
    }
    if ((appointment.status === "finalizado" || appointment.status === "entregue") && oldStatus !== "finalizado" && oldStatus !== "entregue") {
      const customer = this.customers.find((c) => c.id === appointment.customerId);
      const vehicle = this.vehicles.find((v) => v.id === appointment.vehicleId);
      const service = this.services.find((s) => s.id === appointment.serviceId);
      if (customer) {
        this.triggerAutomation("servico_finalizado", { customer, vehicle, service, appointment });
        this.triggerAutomation("pagamento_recebido", { customer, vehicle, service, appointment });
      }
      await this.checkAndReleaseReferralCredits(appointment.customerId);
      await this.syncWithSupabase();
    }
  }
  async deleteAppointment(id) {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      const { error } = await supabase.from("agendamentos").delete().eq("id", id);
      if (error) {
        console.error("Erro ao deletar agendamento do Supabase:", error.message);
        throw error;
      }
    }
    this.appointments = this.appointments.filter((a) => a.id !== id);
    this.save();
  }
  async checkAndReleaseReferralCredits(customerId) {
    const customer = this.customers.find((c) => c.id === customerId);
    if (!customer || !customer.referredBy)
      return;
    const finishedAppts = this.appointments.filter((a) => a.customerId === customerId && (a.status === "finalizado" || a.status === "entregue"));
    if (finishedAppts.length === 1) {
      const referrer = this.customers.find((c) => c.id === customer.referredBy);
      const percent = this.config.referralDiscountPercent ?? 10;
      const serviceValue = finishedAppts[0].value;
      const bonusAmount = Number((serviceValue * percent / 100).toFixed(2));
      customer.referralDiscountAvailable = true;
      customer.referralServiceValue = serviceValue;
      customer.referralBonusPercentUsed = percent;
      customer.referralBonusAmount = bonusAmount;
      await this.updateCustomer(customer.id, {
        referralDiscountAvailable: true,
        referralServiceValue: serviceValue,
        referralBonusPercentUsed: percent,
        referralBonusAmount: bonusAmount
      });
      if (referrer) {
        referrer.referralDiscountAvailable = true;
        await this.updateCustomer(referrer.id, {
          referralDiscountAvailable: true
        });
      }
      const logMsg = `Indicação Concluída! ${referrer ? referrer.name : "Indicador"} e ${customer.name} ganharam desconto de indicação. Valor do serviço: R$ ${serviceValue.toFixed(2)}, Bônus Gerado (${percent}%): R$ ${bonusAmount.toFixed(2)}`;
      this.addLog({
        id: generateUUID(),
        triggerEvent: "Indicação Concluída",
        targetName: referrer ? referrer.name : "Indicador",
        targetContact: referrer ? referrer.phone : "",
        payload: logMsg,
        status: "sucesso",
        timestamp: new Date().toISOString()
      });
    }
  }
  addTransaction(transaction) {
    const newTransaction = {
      ...transaction,
      id: "t_" + Date.now()
    };
    this.finances.unshift(newTransaction);
    this.save();
    return newTransaction;
  }
  deleteTransaction(id) {
    this.finances = this.finances.filter((t) => t.id !== id);
    this.save();
  }
  async addVehicleModel(model) {
    const id = generateUUID();
    const newModel = {
      ...model,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      try {
        const { error } = await supabase.from("vehicle_models").insert({
          id,
          manufacturer: model.manufacturer,
          model: model.model,
          size_category: model.size_category,
          active: model.active
        });
        if (error) {
          console.warn("Erro ao salvar modelo no Supabase:", error.message);
        }
      } catch (e) {
        console.warn("Falha na inserção no Supabase:", e.message);
      }
    }
    this.vehicleModels.push(newModel);
    this.save();
    return newModel;
  }
  async updateVehicleModel(id, updated) {
    const updateData = {
      ...updated,
      updated_at: new Date().toISOString()
    };
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      try {
        const dbPayload = {};
        if (updated.manufacturer !== undefined)
          dbPayload.manufacturer = updated.manufacturer;
        if (updated.model !== undefined)
          dbPayload.model = updated.model;
        if (updated.size_category !== undefined)
          dbPayload.size_category = updated.size_category;
        if (updated.active !== undefined)
          dbPayload.active = updated.active;
        const { error } = await supabase.from("vehicle_models").update(dbPayload).eq("id", id);
        if (error) {
          console.warn("Erro ao atualizar modelo no Supabase:", error.message);
        }
      } catch (e) {
        console.warn("Falha na atualização no Supabase:", e.message);
      }
    }
    this.vehicleModels = this.vehicleModels.map((m) => m.id === id ? { ...m, ...updateData } : m);
    this.save();
  }
  async deleteVehicleModel(id) {
    if (this.config.useRealSupabase) {
      const supabase = this.getSupabaseClient();
      try {
        const { error } = await supabase.from("vehicle_models").delete().eq("id", id);
        if (error) {
          console.warn("Erro ao deletar modelo do Supabase:", error.message);
        }
      } catch (e) {
        console.warn("Falha na exclusão no Supabase:", e.message);
      }
    }
    this.vehicleModels = this.vehicleModels.filter((m) => m.id !== id);
    this.save();
  }
  async updateConfig(updated) {
    this.config = { ...this.config, ...updated };
    this.save();
    if (this.config.useRealSupabase) {
      await this.saveConfigToSupabase();
      this.syncWithSupabase();
    }
  }
  async updateAutomationTrigger(id, updated) {
    this.automations = this.automations.map((a) => a.id === id ? { ...a, ...updated } : a);
    this.save();
    if (this.config.useRealSupabase) {
      await this.saveConfigToSupabase();
      if (this.onSyncCallback) {
        this.onSyncCallback();
      }
    }
  }
  testTrigger(eventId) {
    const automation = this.automations.find((a) => a.id === eventId);
    if (!automation)
      return;
    const sampleCustomer = this.customers[0] || DEFAULT_CUSTOMERS[0];
    const sampleVehicle = this.vehicles.find((v) => v.customerId === sampleCustomer.id) || DEFAULT_VEHICLES[0];
    const sampleService = this.services[0] || DEFAULT_SERVICES[0];
    const sampleAppointment = {
      id: "sample_appt",
      customerId: sampleCustomer.id,
      vehicleId: sampleVehicle.id,
      serviceId: sampleService.id,
      dateTime: new Date().toISOString().slice(0, 16),
      status: "confirmado",
      value: sampleService.basePrice,
      employeeId: "Matheus",
      notes: "Agendamento de teste simulador."
    };
    this.triggerAutomation(automation.event, {
      customer: sampleCustomer,
      vehicle: sampleVehicle,
      service: sampleService,
      appointment: sampleAppointment
    });
  }
  async checkAndTriggerReminders() {
    const logs = [];
    let checked = 0;
    let sent = 0;
    const now = new Date;
    const limit = new Date(now.getTime() + 60 * 60 * 1000);
    const automation = this.automations.find((a) => a.event === "lembrete_agendamento");
    const isAutomationActive = automation ? automation.isActive : false;
    logs.push(`[Reminder Engine] Iniciando verificação às ${now.toLocaleTimeString("pt-BR")}. Automação ativa: ${isAutomationActive ? "Sim" : "Não"}`);
    if (!isAutomationActive) {
      return { checked, sent, logs };
    }
    const eligibleAppts = this.appointments.filter((appt) => {
      if (appt.status === "cancelado")
        return false;
      if (appt.reminderSent)
        return false;
      try {
        const apptDate = new Date(appt.dateTime);
        if (isNaN(apptDate.getTime()))
          return false;
        return apptDate >= now && apptDate <= limit;
      } catch (e) {
        return false;
      }
    });
    checked = eligibleAppts.length;
    logs.push(`[Reminder Engine] Encontrados ${checked} agendamentos pendentes nas próximas 1 hora.`);
    for (const appt of eligibleAppts) {
      const customer = this.customers.find((c) => c.id === appt.customerId);
      if (!customer) {
        logs.push(`[Reminder Engine] Cliente não encontrado para o agendamento ${appt.id}.`);
        continue;
      }
      const vehicle = this.vehicles.find((v) => v.id === appt.vehicleId);
      const service = this.services.find((s) => s.id === appt.serviceId);
      this.triggerAutomation("lembrete_agendamento", {
        customer,
        vehicle,
        service,
        appointment: appt
      });
      appt.reminderSent = true;
      sent++;
      logs.push(`[Reminder Engine] Lembrete enviado com sucesso para ${customer.name} (Veículo: ${vehicle?.brand} ${vehicle?.model}, Horário: ${appt.dateTime.split("T")[1] || ""}).`);
    }
    if (sent > 0) {
      this.save();
      if (this.config.useRealSupabase) {
        try {
          const supabase = this.getSupabaseClient();
          for (const appt of eligibleAppts) {
            await supabase.from("agendamentos").update(mapFrontendAppointmentToDb(appt)).eq("id", appt.id);
          }
          await this.syncWithSupabase();
        } catch (e) {
          console.error(`[Reminder Engine Error] Erro ao salvar status de lembrete no Supabase:`, e);
          logs.push(`[Reminder Engine Error] Erro ao sincronizar com Supabase: ${e.message || e}`);
        }
      }
      if (this.onSyncCallback) {
        this.onSyncCallback();
      }
    }
    return { checked, sent, logs };
  }
  async resetToDefaults() {
    this.customers = DEFAULT_CUSTOMERS;
    this.vehicles = DEFAULT_VEHICLES;
    this.services = DEFAULT_SERVICES;
    this.appointments = DEFAULT_APPOINTMENTS;
    this.history = [];
    this.finances = [];
    this.config = DEFAULT_CONFIG;
    this.automations = DEFAULT_AUTOMATIONS;
    this.logs = [];
    this.save();
    if (this.config.useRealSupabase) {
      await this.saveConfigToSupabase();
      this.syncWithSupabase();
    }
  }
  async restoreDefaultAutomations() {
    console.log("[Automation Restore] Forçando restauração das automações padrão...");
    this.automations = JSON.parse(JSON.stringify(DEFAULT_AUTOMATIONS));
    this.save();
    if (this.config.useRealSupabase) {
      await this.saveConfigToSupabase();
    }
    if (this.onSyncCallback) {
      this.onSyncCallback();
    }
  }
  async queueAutomation(event, context) {
    const trigger = this.automations.find((a) => a.event === event);
    if (!trigger || !trigger.isActive) {
      console.log(`[Queue] Gatilho "${event}" não encontrado ou está inativo.`);
      return null;
    }
    const normalized = renderAndNormalizeMessage(trigger.template, context);
    const id = `exec_${event}_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
    const nowStr = new Date().toISOString();
    let targetTime = nowStr;
    const startHour = this.config.automationStartHour || "08:00";
    const endHour = this.config.automationEndHour || "20:00";
    const now = new Date;
    const currentHourStr = now.toTimeString().slice(0, 5);
    if (currentHourStr < startHour || currentHourStr > endHour) {
      const deferredDate = new Date;
      if (currentHourStr > endHour) {
        deferredDate.setDate(deferredDate.getDate() + 1);
      }
      const [sh, sm] = startHour.split(":").map(Number);
      deferredDate.setHours(sh, sm, 0, 0);
      targetTime = deferredDate.toISOString();
      console.log(`[Queue] Fora do horário operacional (${startHour}-${endHour}). Disparo "${event}" postergado para: ${targetTime}`);
    }
    const execution = {
      id,
      empresa_id: "c0000000-0000-0000-0000-000000000000",
      automacao: event,
      appointment_id: context.appointment?.id,
      customer_id: context.customer.id,
      telefone: context.customer.phone || context.customer.whatsapp || "",
      mensagem: normalized,
      status: "pendente",
      tentativas: 0,
      resposta_api: "",
      data_execucao: targetTime,
      created_at: nowStr,
      updated_at: nowStr
    };
    this.executions.push(execution);
    this.save();
    if (this.config.useRealSupabase) {
      try {
        const supabase = this.getSupabaseClient();
        const { error } = await supabase.from("automacoes_execucoes").insert({
          id: execution.id,
          empresa_id: execution.empresa_id,
          automacao: execution.automacao,
          appointment_id: execution.appointment_id || null,
          customer_id: execution.customer_id,
          telefone: execution.telefone,
          mensagem: execution.mensagem,
          status: execution.status,
          tentativas: execution.tentativas,
          resposta_api: execution.resposta_api,
          data_execucao: execution.data_execucao,
          created_at: execution.created_at,
          updated_at: execution.updated_at
        });
        if (error) {
          console.error(`[Queue] Erro ao salvar execução no Supabase:`, error.message);
        } else {
          console.log(`[Queue] Execução salva com sucesso no Supabase.`);
        }
      } catch (err) {
        console.error(`[Queue] Erro na requisição Supabase:`, err.message || err);
      }
    }
    return execution;
  }
  getPostgresSchemaSql() {
    return `-- =========================================================================
-- SCRIPT DE CRIAÇÃO DO BANCO DE DADOS POSTGRESQL (SUPABASE / CLOUD SQL)
-- Empresa: Senhora Limpeza Estética Automotiva
-- =========================================================================

-- 1. Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    birth_date DATE,
    address TEXT,
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(50),
    cpf VARCHAR(20),
    referral_code VARCHAR(50) UNIQUE,
    referred_by VARCHAR(50),
    credits_balance DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Veículos
CREATE TABLE IF NOT EXISTS public.veiculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    plate VARCHAR(20) UNIQUE NOT NULL,
    color VARCHAR(50),
    year VARCHAR(10),
    mileage VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Serviços Disponíveis
CREATE TABLE IF NOT EXISTS public.servicos_disponiveis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    estimated_time INTEGER NOT NULL, -- em minutos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES public.veiculos(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.servicos_disponiveis(id) ON DELETE SET NULL,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente'::character varying NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    employee_id VARCHAR(100),
    notes TEXT,
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Tabela Exclusiva para Execuções das Automações (SaaS Core)
CREATE TABLE IF NOT EXISTS public.automacoes_execucoes (
    id VARCHAR(100) PRIMARY KEY,
    empresa_id UUID DEFAULT 'c0000000-0000-0000-0000-000000000000'::uuid NOT NULL,
    automacao VARCHAR(100) NOT NULL,
    appointment_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    telefone VARCHAR(50) NOT NULL,
    mensagem TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pendente'::character varying NOT NULL,
    tentativas INTEGER DEFAULT 0 NOT NULL,
    resposta_api TEXT,
    data_execucao TIMESTAMP WITH TIME ZONE NOT NULL,
    data_proxima_tentativa TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Tabela de Usuários (Vinculada ao Supabase Auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'ativo' NOT NULL,
    perfil VARCHAR(50) DEFAULT 'tecnico' NOT NULL,
    foto_url TEXT,
    permissions JSONB DEFAULT '{}'::jsonb NOT NULL,
    commissions JSONB DEFAULT '[]'::jsonb NOT NULL,
    default_commission_percent DECIMAL(5,2) DEFAULT 10.00 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de Performance recomendados para SaaS
CREATE INDEX IF NOT EXISTS idx_execucoes_status ON public.automacoes_execucoes(status);
CREATE INDEX IF NOT EXISTS idx_execucoes_data_execucao ON public.automacoes_execucoes(data_execucao);
CREATE INDEX IF NOT EXISTS idx_execucoes_customer ON public.automacoes_execucoes(customer_id);
CREATE INDEX IF NOT EXISTS idx_execucoes_appointment ON public.automacoes_execucoes(appointment_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_date_time ON public.agendamentos(date_time);
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON public.usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON public.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_status ON public.usuarios(status);

-- POLÍTICAS DE SEGURANÇA (RLS) PARA A TABELA USUÁRIOS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios NO FORCE ROW LEVEL SECURITY;

-- Remove políticas anteriores, inclusive as que consultavam public.usuarios
-- diretamente e causavam recursão infinita no RLS.
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'usuarios'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.usuarios',
            policy_record.policyname
        );
    END LOOP;
END $$;

-- A função é executada pelo proprietário e não reaplica o RLS da tabela.
-- Ela não recebe IDs externos: sempre avalia exclusivamente auth.uid().
CREATE OR REPLACE FUNCTION public.is_active_usuario_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.usuarios AS u
        WHERE u.auth_user_id = (SELECT auth.uid())
          AND u.perfil = 'admin'
          AND u.status = 'ativo'
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_usuario_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_usuario_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_usuario_admin() TO authenticated;

CREATE POLICY "usuarios_select_own_or_admin"
ON public.usuarios
FOR SELECT
TO authenticated
USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT public.is_active_usuario_admin())
);

CREATE POLICY "usuarios_insert_admin"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK ((SELECT public.is_active_usuario_admin()));

CREATE POLICY "usuarios_update_admin"
ON public.usuarios
FOR UPDATE
TO authenticated
USING ((SELECT public.is_active_usuario_admin()))
WITH CHECK ((SELECT public.is_active_usuario_admin()));

CREATE POLICY "usuarios_delete_admin"
ON public.usuarios
FOR DELETE
TO authenticated
USING ((SELECT public.is_active_usuario_admin()));
`;
  }
  getUsers() {
    return this.users;
  }
  async refreshUsersFromSupabase() {
    if (!this.config.useRealSupabase) {
      throw new Error("O cadastro de usuários exige uma conexão ativa com o Supabase.");
    }
    const supabase = this.getSupabaseClient();
    const { data, error } = await supabase.from("usuarios").select(`
        id,
        auth_user_id,
        nome,
        email,
        telefone,
        status,
        perfil,
        foto_url,
        permissions,
        commissions,
        default_commission_percent,
        created_at,
        updated_at
      `).order("nome", { ascending: true });
    if (error) {
      throw new Error(`Não foi possível atualizar a lista real de usuários: ${error.message}`);
    }
    this.users = (data || []).map(mapDbUserToFrontend);
    this.save();
    this.onSyncCallback?.();
    return this.users;
  }
  async addUser(userData) {
    if (!this.config.useRealSupabase) {
      throw new Error("O cadastro de usuários exige uma conexão ativa com o Supabase.");
    }
    if (!userData.password || userData.password.length < 6) {
      throw new Error("A senha deve conter no mínimo 6 caracteres.");
    }
    const supabase = this.getSupabaseClient();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (sessionError || !session?.access_token) {
      throw new Error("Sua sessão administrativa expirou. Entre novamente antes de cadastrar o usuário.");
    }
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      },
      body: {
        nome: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        telefone: userData.phone || "",
        foto_url: userData.photoUrl || "",
        perfil: userData.role,
        status: userData.status,
        permissions: userData.permissions,
        commissions: userData.commissions,
        default_commission_percent: userData.defaultCommissionPercent
      }
    });
    if (error) {
      let backendMessage = data?.error || error.message || "Falha ao criar o usuário.";
      const response = error.context;
      if (response && typeof response.clone === "function") {
        try {
          const payload = await response.clone().json();
          backendMessage = payload?.error || backendMessage;
        } catch {}
      }
      throw new Error(backendMessage);
    }
    const createdAuthUserId = data?.user?.auth_user_id;
    if (!createdAuthUserId) {
      throw new Error("A função concluiu sem retornar o vínculo auth_user_id criado.");
    }
    await this.refreshUsersFromSupabase();
    const createdUser = this.users.find((user) => user.authUserId === createdAuthUserId);
    if (!createdUser) {
      throw new Error("O usuário foi criado, mas seu perfil não apareceu na leitura de public.usuarios. Não repita o cadastro; atualize a tela e verifique as políticas RLS.");
    }
    return createdUser;
  }
  async updateUser(id, updated) {
    const user = this.users.find((u) => u.id === id);
    if (!user)
      return;
    const { password: _discardedPassword, ...safeUpdated } = updated;
    Object.assign(user, safeUpdated, { updatedAt: new Date().toISOString() });
    delete user.password;
    if (this.config.useRealSupabase) {
      try {
        const supabase = this.getSupabaseClient();
        const payload = {
          nome: user.name,
          email: user.email,
          telefone: user.phone || "",
          status: user.status || "ativo",
          perfil: user.role || "tecnico",
          foto_url: user.photoUrl || "",
          permissions: user.permissions,
          commissions: user.commissions,
          default_commission_percent: user.defaultCommissionPercent ?? 10,
          updated_at: user.updatedAt
        };
        if (user.authUserId) {
          payload.auth_user_id = user.authUserId;
        }
        const { error } = await supabase.from("usuarios").update(payload).eq("id", id);
        if (error) {
          console.error("[Supabase Users Update Error]:", error.message);
        } else {
          console.log(`[Supabase Users Update] Usuário ${id} atualizado com sucesso na tabela usuarios.`);
        }
      } catch (err) {
        console.warn("[Supabase Users Update Exception]:", err);
      }
    }
    this.save();
    this.recalculateCommissions();
  }
  async deleteUser(id) {
    if (this.config.useRealSupabase) {
      try {
        const supabase = this.getSupabaseClient();
        await supabase.from("usuarios").delete().eq("id", id);
      } catch (err) {
        console.warn("[Supabase Users Delete Error]:", err);
      }
    }
    this.users = this.users.filter((u) => u.id !== id);
    this.save();
  }
  calculateCommissionForAppointment(appointment) {
    const records = [];
    if (appointment.status !== "finalizado" && appointment.status !== "entregue") {
      return records;
    }
    const empId = (appointment.employeeId || "").trim();
    if (!empId) {
      return records;
    }
    const assignedUser = this.users.find((u) => (u.id === empId || u.name.toLowerCase() === empId.toLowerCase()) && u.status === "ativo");
    if (!assignedUser) {
      return records;
    }
    const targetServiceIds = appointment.serviceIds && appointment.serviceIds.length > 0 ? appointment.serviceIds : [appointment.serviceId];
    const customer = this.customers.find((c) => c.id === appointment.customerId);
    const customerName = customer ? customer.name : "Cliente Estética";
    const apptDate = appointment.dateTime ? appointment.dateTime.split("T")[0] : getCurrentDateStr();
    for (const sId of targetServiceIds) {
      const serviceObj = this.services.find((s) => s.id === sId);
      if (!serviceObj)
        continue;
      const serviceValue = serviceObj.basePrice || appointment.value / (targetServiceIds.length || 1);
      const customRule = assignedUser.commissions?.find((c) => c.serviceId === sId);
      const commissionPercent = customRule !== undefined ? customRule.percentage : assignedUser.defaultCommissionPercent ?? 0;
      const commissionValue = Number((serviceValue * commissionPercent / 100).toFixed(2));
      records.push({
        id: `comm_${appointment.id}_${sId}`,
        userId: assignedUser.id,
        userName: assignedUser.name,
        appointmentId: appointment.id,
        customerName,
        serviceName: serviceObj.name,
        serviceValue: Number(serviceValue.toFixed(2)),
        commissionPercent,
        commissionValue,
        date: apptDate,
        status: "pendente",
        createdAt: new Date().toISOString()
      });
    }
    return records;
  }
  recalculateCommissions() {
    const completedAppts = this.appointments.filter((a) => a.status === "finalizado" || a.status === "entregue");
    const paidCommissions = this.commissions.filter((c) => c.status === "paga");
    const updatedList = [...paidCommissions];
    for (const appt of completedAppts) {
      const generated = this.calculateCommissionForAppointment(appt);
      for (const rec of generated) {
        const isPaid = paidCommissions.some((p) => p.id === rec.id || p.appointmentId === rec.appointmentId && p.serviceName === rec.serviceName);
        if (!isPaid) {
          const idx = updatedList.findIndex((n) => n.id === rec.id || n.appointmentId === rec.appointmentId && n.serviceName === rec.serviceName);
          if (idx >= 0) {
            updatedList[idx] = { ...rec, status: updatedList[idx].status, paidAt: updatedList[idx].paidAt, notes: updatedList[idx].notes };
          } else {
            updatedList.push(rec);
          }
        }
      }
    }
    this.commissions = updatedList;
    this.save();
  }
  markCommissionAsPaid(commissionId, notes) {
    const comm = this.commissions.find((c) => c.id === commissionId);
    if (comm) {
      comm.status = "paga";
      comm.paidAt = getCurrentDateStr();
      if (notes)
        comm.notes = notes;
      this.save();
    }
  }
  markBulkCommissionsAsPaid(commissionIds, notes) {
    const today = getCurrentDateStr();
    for (const id of commissionIds) {
      const comm = this.commissions.find((c) => c.id === id);
      if (comm) {
        comm.status = "paga";
        comm.paidAt = today;
        if (notes)
          comm.notes = notes;
      }
    }
    this.save();
  }
}
var dbInstance = new LocalDatabase;
function cleanAndNormalizeMessageString(msg) {
  if (!msg)
    return "";
  let normalized = msg.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
  normalized = normalized.replace(/\\+n/gi, `
`);
  normalized = normalized.replace(/\/+n/gi, `
`);
  normalized = normalized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  normalized = normalized.replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/g, "");
  return normalized;
}
function renderAndNormalizeMessage(template, context) {
  const originalTemplateLog = template;
  let text = template || "";
  if (context.customer) {
    text = text.replace(/{nome}/g, context.customer.name || "");
    text = text.replace(/{whatsapp}/g, context.customer.phone || context.customer.whatsapp || "");
  } else {
    text = text.replace(/{nome}/g, "").replace(/{whatsapp}/g, "");
  }
  if (context.vehicle) {
    text = text.replace(/{veiculo}/g, `${context.vehicle.brand} ${context.vehicle.model} (${context.vehicle.plate})`);
  } else {
    text = text.replace(/{veiculo}/g, "");
  }
  let resolvedServiceName = "";
  if (context.appointment && context.appointment.serviceIds && context.appointment.serviceIds.length > 0) {
    const list = context.appointment.serviceIds.map((id) => dbInstance.services.find((s) => s.id === id)?.name).filter(Boolean);
    if (list.length > 0) {
      resolvedServiceName = list.join(", ");
    } else if (context.service) {
      resolvedServiceName = context.service.name || "";
    }
  } else if (context.service) {
    resolvedServiceName = context.service.name || "";
  }
  text = text.replace(/{servico}/g, resolvedServiceName);
  if (context.appointment) {
    const formattedDate = new Date(context.appointment.dateTime).toLocaleString("pt-BR");
    text = text.replace(/{data_hora}/g, formattedDate);
    text = text.replace(/{valor}/g, typeof context.appointment.value === "number" ? context.appointment.value.toFixed(2) : String(context.appointment.value));
  } else {
    text = text.replace(/{data_hora}/g, "").replace(/{valor}/g, "");
  }
  const textAfterSubstitutionLog = text;
  const finalMessage = cleanAndNormalizeMessageString(text);
  console.log(`[Unified Message Engine] --- MENSAGEM PROCESSADA ---`);
  console.log(`[Unified Message Engine] Template Original:`, JSON.stringify(originalTemplateLog));
  console.log(`[Unified Message Engine] Texto Após Substituição:`, JSON.stringify(textAfterSubstitutionLog));
  console.log(`[Unified Message Engine] Texto Final Normalizado:`, JSON.stringify(finalMessage));
  console.log(`[Unified Message Engine] ----------------------------`);
  return finalMessage;
}
function validatePayload(payload) {
  try {
    const jsonStr = JSON.stringify(payload);
    const controlCharRegex = /[\x00-\x1F]/;
    const match = jsonStr.match(controlCharRegex);
    if (match) {
      const charCode = match[0].charCodeAt(0);
      return {
        valid: false,
        error: `O JSON serializado possui caracteres de controle não escapados na faixa ASCII 0-31 (código: ${charCode})`
      };
    }
    JSON.parse(jsonStr);
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: err.message || "Erro de análise estrutural do JSON"
    };
  }
}

// src/db/automationEngine.ts
class AutomationEngine {
  isProcessing = false;
  constructor() {
    console.log("[Automation Engine] Inicializado.");
  }
  async runCycle() {
    const logs = [];
    if (this.isProcessing) {
      logs.push("[Automation Engine] Ciclo ignorado: ciclo anterior ainda em andamento.");
      return { generated: 0, processed: 0, logs };
    }
    this.isProcessing = true;
    let generatedCount = 0;
    let processedCount = 0;
    try {
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
      }
      generatedCount = await this.scanAndGenerateExecutions(logs);
      processedCount = await this.processQueue(logs);
    } catch (error) {
      console.error("[Automation Engine Error]", error);
      logs.push(`[Automation Engine Error] Erro crítico no ciclo: ${error.message || error}`);
    } finally {
      this.isProcessing = false;
    }
    return { generated: generatedCount, processed: processedCount, logs };
  }
  async scanAndGenerateExecutions(logs) {
    let count = 0;
    const nowIso = new Date().toISOString();
    const reminderTrigger = dbInstance.automations.find((a) => a.event === "lembrete_agendamento");
    if (reminderTrigger && reminderTrigger.isActive) {
      const now = new Date;
      const limit = new Date(now.getTime() + 60 * 60 * 1000);
      const eligibleAppts = dbInstance.appointments.filter((appt) => {
        if (appt.status === "cancelado" || appt.status === "finalizado" || appt.status === "entregue")
          return false;
        const apptDate = new Date(appt.dateTime);
        const isImminent = apptDate > now && apptDate <= limit;
        if (!isImminent)
          return false;
        const hasBeenQueued = dbInstance.executions.some((e) => e.automacao === "lembrete_agendamento" && e.appointment_id === appt.id && e.status !== "erro_definitivo");
        return !hasBeenQueued;
      });
      for (const appt of eligibleAppts) {
        const customer = dbInstance.customers.find((c) => c.id === appt.customerId);
        if (!customer)
          continue;
        const vehicle = dbInstance.vehicles.find((v) => v.id === appt.vehicleId);
        const service = dbInstance.services.find((s) => s.id === appt.serviceId);
        const execution = await dbInstance.queueAutomation("lembrete_agendamento", {
          customer,
          vehicle,
          service,
          appointment: appt
        });
        if (execution) {
          count++;
          logs.push(`[Reminder Scan] Lembrete agendado para o cliente ${customer.name} (Agendamento: ${appt.id}).`);
        }
      }
    }
    const bdayTrigger = dbInstance.automations.find((a) => a.event === "aniversario");
    if (bdayTrigger && bdayTrigger.isActive) {
      const todayStr = new Date().toISOString().slice(5, 10);
      const currentYear = new Date().getFullYear().toString();
      const eligibleBdays = dbInstance.customers.filter((customer) => {
        if (!customer.birthDate)
          return false;
        const bdayMonthDay = customer.birthDate.slice(5, 10);
        if (bdayMonthDay !== todayStr)
          return false;
        const hasBeenQueued = dbInstance.executions.some((e) => e.automacao === "aniversario" && e.customer_id === customer.id && e.created_at.startsWith(currentYear) && e.status !== "erro_definitivo");
        return !hasBeenQueued;
      });
      for (const customer of eligibleBdays) {
        const execution = await dbInstance.queueAutomation("aniversario", { customer });
        if (execution) {
          count++;
          logs.push(`[Birthday Scan] Mensagem de aniversário agendada para ${customer.name}.`);
        }
      }
    }
    const inactiveTrigger = dbInstance.automations.find((a) => a.event === "cliente_inativo");
    if (inactiveTrigger && inactiveTrigger.isActive) {
      const inactiveDays = inactiveTrigger.inactiveDays || 30;
      const thresholdDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      for (const customer of dbInstance.customers) {
        const customerAppts = dbInstance.appointments.filter((a) => a.customerId === customer.id);
        if (customerAppts.length === 0)
          continue;
        const latestAppt = customerAppts.reduce((latest, current) => {
          return new Date(current.dateTime) > new Date(latest.dateTime) ? current : latest;
        });
        const lastApptDate = new Date(latestAppt.dateTime);
        const hasFutureAppt = customerAppts.some((a) => new Date(a.dateTime) > new Date);
        if (lastApptDate < thresholdDate && !hasFutureAppt) {
          const hasBeenQueued = dbInstance.executions.some((e) => e.automacao === "cliente_inativo" && e.customer_id === customer.id && e.created_at >= thirtyDaysAgo && e.status !== "erro_definitivo");
          if (!hasBeenQueued) {
            const vehicle = dbInstance.vehicles.find((v) => v.customerId === customer.id);
            const execution = await dbInstance.queueAutomation("cliente_inativo", {
              customer,
              vehicle
            });
            if (execution) {
              count++;
              logs.push(`[Inactive Scan] Mensagem de reativação agendada para ${customer.name}.`);
            }
          }
        }
      }
    }
    const posVendaTrigger = dbInstance.automations.find((a) => a.event === "pagamento_recebido");
    if (posVendaTrigger && posVendaTrigger.isActive) {
      const recentFinished = dbInstance.appointments.filter((appt) => {
        if (appt.status !== "finalizado" && appt.status !== "entregue")
          return false;
        const hasBeenQueued = dbInstance.executions.some((e) => e.automacao === "pagamento_recebido" && e.appointment_id === appt.id && e.status !== "erro_definitivo");
        return !hasBeenQueued;
      });
      for (const appt of recentFinished) {
        const customer = dbInstance.customers.find((c) => c.id === appt.customerId);
        if (!customer)
          continue;
        const vehicle = dbInstance.vehicles.find((v) => v.id === appt.vehicleId);
        const service = dbInstance.services.find((s) => s.id === appt.serviceId);
        const execution = await dbInstance.queueAutomation("pagamento_recebido", {
          customer,
          vehicle,
          service,
          appointment: appt
        });
        if (execution) {
          count++;
          logs.push(`[Feedback Scan] Pesquisa de satisfação agendada para ${customer.name} (Agendamento: ${appt.id}).`);
        }
      }
    }
    return count;
  }
  async processQueue(logs) {
    const nowIso = new Date().toISOString();
    const pendingExecutions = dbInstance.executions.filter((e) => e.status === "pendente" && e.data_execucao <= nowIso);
    if (pendingExecutions.length === 0) {
      return 0;
    }
    let processedCount = 0;
    const startHour = dbInstance.config.automationStartHour || "08:00";
    const endHour = dbInstance.config.automationEndHour || "20:00";
    if (!this.isWithinOperationalWindow(startHour, endHour)) {
      logs.push(`[Operational Window] Fora do horário de funcionamento (${startHour} - ${endHour}). Postergando agendamentos pendentes.`);
      const nextStart = this.getNextStartTime(startHour);
      for (const exec of pendingExecutions) {
        exec.data_execucao = nextStart;
        exec.updated_at = new Date().toISOString();
        if (dbInstance.config.useRealSupabase) {
          try {
            const supabase = dbInstance.getSupabaseClient();
            await supabase.from("automacoes_execucoes").update({ data_execucao: exec.data_execucao, updated_at: exec.updated_at }).eq("id", exec.id);
          } catch (e) {}
        }
      }
      dbInstance.save();
      return 0;
    }
    for (const exec of pendingExecutions) {
      processedCount++;
      logs.push(`[Queue Processor] Processando envio da execução ${exec.id} (${exec.automacao}) para ${exec.telefone}...`);
      exec.status = "processando";
      exec.tentativas += 1;
      exec.updated_at = new Date().toISOString();
      dbInstance.save();
      let success = false;
      let apiResponse = "";
      const payloadBody = {
        event: exec.automacao,
        executionId: exec.id,
        telefone: exec.telefone,
        formattedMessage: exec.mensagem,
        timestamp: exec.updated_at
      };
      try {
        if (dbInstance.config.makeWebhookUrl) {
          const makeUrl = dbInstance.config.makeWebhookUrl;
          console.log(`[Queue Processor Webhook] Payload enviado ao Make (URL: ${makeUrl}):`, JSON.stringify(payloadBody, null, 2));
          const response = await fetch(makeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadBody)
          });
          const resText = await response.text();
          console.log(`[Queue Processor Webhook] Payload recebido pelo Make (Resposta). Status: ${response.status} | Body: ${resText}`);
          apiResponse += `[Make Webhook] Status: ${response.status} | Resposta: ${resText}
`;
          if (response.ok) {
            success = true;
          }
        }
        if (dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken) {
          const zapiUrl = `https://api.z-api.io/instances/${dbInstance.config.zapiInstanceId}/token/${dbInstance.config.zapiToken}/send-text`;
          const zapiPayload = {
            phone: exec.telefone,
            message: exec.mensagem
          };
          console.log(`[Queue Processor Z-API] Payload enviado para a Z-API (URL: ${zapiUrl}):`, JSON.stringify(zapiPayload, null, 2));
          const headers = { "Content-Type": "application/json" };
          if (dbInstance.config.zapiClientToken) {
            headers["Client-Token"] = dbInstance.config.zapiClientToken;
          }
          const response = await fetch(zapiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(zapiPayload)
          });
          const resText = await response.text();
          console.log(`[Queue Processor Z-API] Payload recebido da Z-API (Resposta). Status: ${response.status} | Body: ${resText}`);
          apiResponse += `[Z-API] Status: ${response.status} | Resposta: ${resText}
`;
          if (response.ok) {
            success = true;
          }
        }
        if (!dbInstance.config.makeWebhookUrl && !(dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken)) {
          apiResponse = "Envio simulado com sucesso (Sem canais de envio reais configurados)";
          success = true;
        }
      } catch (err) {
        apiResponse += `[Erro de Envio] ${err.message || err}`;
        console.error("[Queue Processor Error] Falha de comunicação:", err);
      }
      if (success) {
        exec.status = "sucesso";
        exec.resposta_api = apiResponse;
        logs.push(`[Queue Processor] Sucesso ao enviar execução ${exec.id}.`);
      } else {
        logs.push(`[Queue Processor] Falha ao enviar execução ${exec.id} (Tentativa ${exec.tentativas}/3).`);
        if (exec.tentativas < 3) {
          exec.status = "pendente";
          const backoffMinutes = exec.tentativas === 1 ? 5 : 15;
          const nextAttemptDate = new Date(Date.now() + backoffMinutes * 60 * 1000);
          exec.data_execucao = nextAttemptDate.toISOString();
          exec.data_proxima_tentativa = nextAttemptDate.toISOString();
          exec.resposta_api = `[TENTATIVA FALHOU] ${apiResponse}`;
          logs.push(`[Queue Processor] Reagendado para ${exec.data_execucao} (${backoffMinutes}min de espera).`);
        } else {
          exec.status = "erro_definitivo";
          exec.resposta_api = `[ERRO DEFINITIVO] ${apiResponse}`;
          logs.push(`[Queue Processor] Falha permanente na execução ${exec.id}.`);
        }
      }
      exec.updated_at = new Date().toISOString();
      dbInstance.save();
      const triggerName = dbInstance.automations.find((a) => a.event === exec.automacao)?.name || exec.automacao;
      const targetCustomer = dbInstance.customers.find((c) => c.id === exec.customer_id);
      const newLog = {
        id: "log_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
        triggerEvent: triggerName,
        targetName: targetCustomer ? targetCustomer.name : "Cliente",
        targetContact: exec.telefone,
        payload: `ID da Execução: ${exec.id}
Tentativa: ${exec.tentativas}
Payload: ${JSON.stringify(payloadBody, null, 2)}
Resposta: ${exec.resposta_api}`,
        status: exec.status === "sucesso" ? "sucesso" : "erro",
        timestamp: exec.updated_at
      };
      dbInstance.addLog(newLog);
      if (dbInstance.config.useRealSupabase) {
        try {
          const supabase = dbInstance.getSupabaseClient();
          const { error } = await supabase.from("automacoes_execucoes").upsert({
            id: exec.id,
            empresa_id: exec.empresa_id,
            automacao: exec.automacao,
            appointment_id: exec.appointment_id,
            customer_id: exec.customer_id,
            telefone: exec.telefone,
            mensagem: exec.mensagem,
            status: exec.status,
            tentativas: exec.tentativas,
            resposta_api: exec.resposta_api,
            data_execucao: exec.data_execucao,
            data_proxima_tentativa: exec.data_proxima_tentativa,
            created_at: exec.created_at,
            updated_at: exec.updated_at
          });
          if (error) {
            console.error("[Supabase Queue Update Error] Erro ao sincronizar status do processador:", error.message);
          }
        } catch (e) {
          console.error("[Supabase Queue Update Error] Falha ao atualizar status no Supabase:", e.message);
        }
      }
    }
    if (dbInstance.onSyncCallback) {
      dbInstance.onSyncCallback();
    }
    return processedCount;
  }
  isWithinOperationalWindow(startHour, endHour) {
    const now = new Date;
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hours}:${minutes}`;
    return currentTime >= startHour && currentTime <= endHour;
  }
  getNextStartTime(startHour) {
    const now = new Date;
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [h, m] = startHour.split(":").map(Number);
    tomorrow.setHours(h || 8, m || 0, 0, 0);
    return tomorrow.toISOString();
  }
  async executeManualTest(eventId) {
    const automation = dbInstance.automations.find((a) => a.id === eventId);
    if (!automation) {
      return { success: false, log: "Automação não encontrada" };
    }
    const sampleCustomer = dbInstance.customers[0] || { id: "test_cust", name: "Cliente de Teste", phone: "5511999998888", whatsapp: "5511999998888", email: "", birthDate: "", address: "", neighborhood: "", city: "", state: "" };
    const sampleVehicle = dbInstance.vehicles.find((v) => v.customerId === sampleCustomer.id) || { id: "test_veh", brand: "Honda", model: "Civic", plate: "ABC1D23", color: "Preto", year: "2022", customerId: sampleCustomer.id, mileage: "12000" };
    const sampleService = dbInstance.services[0] || { id: "test_srv", name: "Serviço de Teste", description: "Serviço de Teste", basePrice: 100, estimatedTime: 60 };
    const sampleAppointment = {
      id: "test_appt_" + Date.now().toString().slice(-4),
      customerId: sampleCustomer.id,
      vehicleId: sampleVehicle.id,
      serviceId: sampleService.id,
      dateTime: new Date().toISOString().slice(0, 16),
      status: "confirmado",
      value: sampleService.basePrice,
      employeeId: "Matheus",
      notes: "Execução manual de teste."
    };
    const execution = await dbInstance.queueAutomation(automation.event, {
      customer: sampleCustomer,
      vehicle: sampleVehicle,
      service: sampleService,
      appointment: sampleAppointment
    });
    if (!execution) {
      return { success: false, log: "Não foi possível enfileirar a automação (provável duplicidade ou inativa)." };
    }
    execution.status = "processando";
    execution.tentativas += 1;
    execution.updated_at = new Date().toISOString();
    dbInstance.save();
    let success = false;
    let apiResponse = "";
    const payloadBody = {
      event: execution.automacao,
      executionId: execution.id,
      telefone: execution.telefone,
      formattedMessage: execution.mensagem,
      timestamp: execution.updated_at,
      isTest: true
    };
    try {
      if (dbInstance.config.makeWebhookUrl) {
        const makeUrl = dbInstance.config.makeWebhookUrl;
        console.log(`[Manual Test Webhook] Payload enviado ao Make (URL: ${makeUrl}):`, JSON.stringify(payloadBody, null, 2));
        const response = await fetch(makeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadBody)
        });
        const resText = await response.text();
        console.log(`[Manual Test Webhook] Payload recebido pelo Make (Resposta). Status: ${response.status} | Body: ${resText}`);
        apiResponse += `[Make Webhook] Status: ${response.status} | Resposta: ${resText}
`;
        if (response.ok)
          success = true;
      }
      if (dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken) {
        const zapiUrl = `https://api.z-api.io/instances/${dbInstance.config.zapiInstanceId}/token/${dbInstance.config.zapiToken}/send-text`;
        const zapiPayload = {
          phone: execution.telefone,
          message: execution.mensagem
        };
        console.log(`[Manual Test Z-API] Payload enviado para a Z-API (URL: ${zapiUrl}):`, JSON.stringify(zapiPayload, null, 2));
        const headers = { "Content-Type": "application/json" };
        if (dbInstance.config.zapiClientToken) {
          headers["Client-Token"] = dbInstance.config.zapiClientToken;
        }
        const response = await fetch(zapiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(zapiPayload)
        });
        const resText = await response.text();
        console.log(`[Manual Test Z-API] Payload recebido da Z-API (Resposta). Status: ${response.status} | Body: ${resText}`);
        apiResponse += `[Z-API] Status: ${response.status} | Resposta: ${resText}
`;
        if (response.ok)
          success = true;
      }
      if (!dbInstance.config.makeWebhookUrl && !(dbInstance.config.zapiInstanceId && dbInstance.config.zapiToken)) {
        apiResponse = "Envio manual simulado com sucesso.";
        success = true;
      }
    } catch (err) {
      apiResponse += `[Erro] ${err.message || err}`;
    }
    execution.status = success ? "sucesso" : "erro_definitivo";
    execution.resposta_api = apiResponse;
    execution.updated_at = new Date().toISOString();
    dbInstance.save();
    if (dbInstance.config.useRealSupabase) {
      try {
        const supabase = dbInstance.getSupabaseClient();
        await supabase.from("automacoes_execucoes").upsert({
          id: execution.id,
          empresa_id: execution.empresa_id,
          automacao: execution.automacao,
          appointment_id: execution.appointment_id,
          customer_id: execution.customer_id,
          telefone: execution.telefone,
          mensagem: execution.mensagem,
          status: execution.status,
          tentativas: execution.tentativas,
          resposta_api: execution.resposta_api,
          data_execucao: execution.data_execucao,
          created_at: execution.created_at,
          updated_at: execution.updated_at
        });
      } catch (e) {}
    }
    const newLog = {
      id: "log_manual_" + Date.now(),
      triggerEvent: automation.name + " (Teste Manual)",
      targetName: sampleCustomer.name,
      targetContact: execution.telefone,
      payload: `ID da Execução: ${execution.id}
Resposta: ${execution.resposta_api}`,
      status: success ? "sucesso" : "erro",
      timestamp: execution.updated_at
    };
    dbInstance.addLog(newLog);
    if (dbInstance.onSyncCallback) {
      dbInstance.onSyncCallback();
    }
    return { success, log: apiResponse };
  }
}
var automationEngineInstance = new AutomationEngine;

// server.ts
async function startServer() {
  const app = import_express.default();
  const PORT = 3000;
  app.use(import_express.default.json());
  app.use(import_express.default.urlencoded({ extended: true }));
  app.get("/api/automations/dashboard", async (req, res) => {
    try {
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
      }
      const executions = dbInstance.executions;
      const now = new Date;
      const todayStr = now.toISOString().slice(0, 10);
      const executionsToday = executions.filter((e) => e.updated_at.startsWith(todayStr));
      const successfulToday = executionsToday.filter((e) => e.status === "sucesso").length;
      const sentCount = executions.filter((e) => e.status === "sucesso").length;
      const pendingCount = executions.filter((e) => e.status === "pendente").length;
      const errorCount = executions.filter((e) => e.status === "erro_definitivo").length;
      const totalFinalized = sentCount + errorCount;
      const successRate = totalFinalized > 0 ? Math.round(sentCount / totalFinalized * 100) : 100;
      const sortedExecutions = [...executions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      const lastExecution = sortedExecutions[0] || null;
      const pendingSorted = executions.filter((e) => e.status === "pendente").sort((a, b) => new Date(a.data_execucao).getTime() - new Date(b.data_execucao).getTime());
      const nextExecution = pendingSorted[0] || null;
      res.json({
        stats: {
          executedToday: executionsToday.length,
          successfulToday,
          sentCount,
          pendingCount,
          errorCount,
          successRate,
          lastExecutionTime: lastExecution ? lastExecution.updated_at : "Nunca",
          nextExecutionTime: nextExecution ? executionTimeFormatted(nextExecution.data_execucao) : "Nenhuma agendada"
        },
        history: sortedExecutions.map((e) => {
          const customer = dbInstance.customers.find((c) => c.id === e.customer_id);
          const automationTrigger = dbInstance.automations.find((a) => a.event === e.automacao);
          return {
            id: e.id,
            horario: e.updated_at,
            cliente: customer ? customer.name : "Cliente",
            telefone: e.telefone,
            automacao: automationTrigger ? automationTrigger.name : e.automacao,
            mensagem: e.mensagem,
            status: e.status,
            tentativas: e.tentativas,
            resposta_api: e.resposta_api,
            data_execucao: e.data_execucao
          };
        })
      });
    } catch (error) {
      console.error("[API Error] Falha ao carregar dashboard de automações:", error);
      res.status(500).json({ error: "Erro ao carregar dashboard de automações", details: error.message });
    }
  });
  app.post("/api/automations/test/:id", async (req, res) => {
    const { id } = req.params;
    try {
      console.log(`[API] Teste manual acionado para ID: ${id}`);
      const result = await automationEngineInstance.executeManualTest(id);
      res.json(result);
    } catch (error) {
      console.error("[API Error] Falha no teste manual:", error);
      res.status(500).json({ success: false, log: `Erro interno: ${error.message}` });
    }
  });
  app.post("/api/automations/run-cycle", async (req, res) => {
    try {
      console.log("[API] Varredura manual da fila acionada.");
      const result = await automationEngineInstance.runCycle();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("[API Error] Falha na execução manual do ciclo:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/database/sync", async (req, res) => {
    try {
      if (dbInstance.config.useRealSupabase) {
        await dbInstance.syncWithSupabase();
        res.json({ success: true, message: "Banco de dados sincronizado com sucesso." });
      } else {
        res.json({ success: false, message: "Supabase não está ativado." });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  if (true) {
    const vite = await import_vite.createServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("[Vite] Middleware de desenvolvimento acoplado com sucesso.");
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend Server] Servidor rodando com sucesso em http://localhost:${PORT}`);
  });
  setInterval(async () => {
    console.log("[Background Worker] Executando ciclo automático da fila...");
    try {
      const result = await automationEngineInstance.runCycle();
      if (result.generated > 0 || result.processed > 0) {
        console.log(`[Background Worker] Ciclo concluído. Gerados: ${result.generated} | Processados: ${result.processed}`);
      }
    } catch (err) {
      console.error("[Background Worker Error] Erro ao executar ciclo automático:", err.message || err);
    }
  }, 60 * 1000);
}
function executionTimeFormatted(isoStr) {
  try {
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} às ${hours}:${minutes}`;
  } catch {
    return isoStr;
  }
}
startServer().catch((err) => {
  console.error("[Backend Crítico] Falha ao iniciar servidor:", err);
});

//# debugId=A3BE0BF5C046023E64756E2164756E21
//# sourceMappingURL=server.cjs.map
