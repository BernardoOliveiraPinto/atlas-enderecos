import { formatCep, normalizeCpf } from "./validation";

const SESSION_KEY = "atlas-session-v3";
const CEP_CACHE = new Map();
const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(
      body.message || "Não foi possível concluir a operação. Tente novamente.",
    );
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

export const dataClient = {
  session() {
    return sessionStorage.getItem(SESSION_KEY) === "active";
  },
  async logout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
      // A sessão pode já ter expirado no servidor; limpar o navegador basta.
    } finally {
      sessionStorage.removeItem(SESSION_KEY);
    }
  },
  async login(cpf, password) {
    const user = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ cpf: normalizeCpf(cpf), password }),
    });
    sessionStorage.setItem(SESSION_KEY, "active");
    return user;
  },
  async me() {
    return request("/api/auth/me");
  },
  async listUsers(_session, currentUser) {
    const data = await request(
      currentUser.role === "ADMIN"
        ? "/api/users"
        : `/api/users/${currentUser.id}`,
    );
    return Array.isArray(data) ? data : [data];
  },
  async createUser(_session, payload) {
    return request("/api/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async saveAddress(_session, userId, payload, addressId) {
    return request(
      `/api/users/${userId}/addresses${addressId ? `/${addressId}` : ""}`,
      { method: addressId ? "PUT" : "POST", body: JSON.stringify(payload) },
    );
  },
  async deleteAddress(_session, userId, addressId) {
    return request(`/api/users/${userId}/addresses/${addressId}`, {
      method: "DELETE",
    });
  },
  async lookupCep(value) {
    const cep = value.replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("Digite um CEP com 8 dígitos.");
    if (CEP_CACHE.has(cep)) return CEP_CACHE.get(cep);
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok)
      throw new Error("Não foi possível consultar o CEP. Tente novamente.");
    const data = await response.json();
    if (data.erro)
      throw new Error("CEP não encontrado. Revise os 8 dígitos informados.");
    const address = {
      cep: formatCep(data.cep),
      street: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
    };
    CEP_CACHE.set(cep, address);
    return address;
  },
};
