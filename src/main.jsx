import { Component, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { dataClient } from "./lib/client";
import { formatCep, formatCpf, isValidCpf } from "./lib/validation";
import { Button } from "./components/ui/button";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

function readUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name) || "";
}
function writeUrlParams(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) =>
    value ? url.searchParams.set(key, value) : url.searchParams.delete(key),
  );
  window.history.replaceState({}, "", url);
}
function showValidationError(setError, message, selector) {
  setError(message);
  window.requestAnimationFrame(() => document.querySelector(selector)?.focus());
}

function Brand() {
  return (
    <div className="brand" translate="no">
      <div className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" focusable="false">
          <path
            d="M16 28s9-8.1 9-15a9 9 0 1 0-18 0c0 6.9 9 15 9 15Z"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="13" r="3" fill="currentColor" />
        </svg>
      </div>
      <div>
        <strong>atlas</strong>
        <span>gestão de endereços</span>
      </div>
    </div>
  );
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <main className="runtime-error">
          <span>ATLAS · diagnóstico</span>
          <h1>Não foi possível carregar a interface.</h1>
          <p>{this.state.error.message}</p>
        </main>
      );
    return this.props.children;
  }
}

function Root() {
  const [session, setSession] = useState(dataClient.session());
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session) return;
    dataClient
      .me(session)
      .then(setCurrentUser)
      .catch((reason) => {
        dataClient.logout();
        setSession(null);
        if (reason.status !== 401) setError(reason.message);
      });
  }, [session]);
  if (!session || !currentUser)
    return (
      <LoginPage
        initialError={error}
        onLogin={(user) => {
          setSession(dataClient.session());
          setCurrentUser(user);
        }}
      />
    );
  return (
    <Dashboard
      session={session}
      currentUser={currentUser}
      onLogout={() => {
        dataClient.logout();
        queryClient.clear();
        setSession(null);
        setCurrentUser(null);
      }}
    />
  );
}

function LoginPage({ initialError, onLogin }) {
  const [cpf, setCpf] = useState("529.982.247-25");
  const [password, setPassword] = useState("Atlas@123");
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      onLogin(await dataClient.login(cpf, password));
    } catch (reason) {
      showValidationError(setError, reason.message, '[name="cpf"]');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-brand">
        <Brand />
        <div className="login-copy">
          <p>Endereços certos deixam cada atendimento mais simples.</p>
          <span>Cadastre, organize e mantenha dados confiáveis.</span>
        </div>
      </section>
      <section className="login-card-wrap">
        <form className="login-card" onSubmit={submit}>
          <span className="eyebrow">ACESSO SEGURO</span>
          <h1>Entre no seu workspace</h1>
          <p>
            Use CPF e senha para acessar apenas as informações permitidas para
            seu perfil.
          </p>
          <Field label="CPF" required>
            <input
              name="cpf"
              inputMode="numeric"
              autoComplete="username"
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Senha" required>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="login-submit" disabled={pending}>
            {pending ? "Entrando…" : "Entrar"}
          </Button>
          <div className="demo-access">
            <b>Acessos para demonstração</b>
            <span>Admin: 529.982.247-25 · Usuário: 111.444.777-35</span>
            <small>Senha: Atlas@123</small>
          </div>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ session, currentUser, onLogout }) {
  const [active, setActive] = useState(() => {
    const requested = readUrlParam("view");
    if (!["overview", "users", "addresses"].includes(requested))
      return "overview";
    return currentUser.role !== "ADMIN" && requested === "users"
      ? "overview"
      : requested;
  });
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id);
  const [userModal, setUserModal] = useState(false);
  const [addressModal, setAddressModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState("");
  const queryCache = useQueryClient();
  const isAdmin = currentUser.role === "ADMIN";
  const {
    data: users = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["users", currentUser.id, currentUser.role],
    queryFn: () => dataClient.listUsers(session, currentUser),
  });
  const selectedUser =
    users.find((user) => user.id === selectedUserId) || users[0];
  useEffect(() => {
    if (!isAdmin) setSelectedUserId(currentUser.id);
  }, [currentUser.id, isAdmin]);
  useEffect(() => {
    writeUrlParams({ view: active });
  }, [active]);
  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(""), 3_000);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);
  const refresh = () => queryCache.invalidateQueries({ queryKey: ["users"] });
  const createUser = useMutation({
    mutationFn: (payload) => dataClient.createUser(session, payload),
    onSuccess: (user) => {
      refresh();
      setUserModal(false);
      setSelectedUserId(user.id);
      setToast("Usuário criado com sucesso.");
    },
  });
  const saveAddress = useMutation({
    mutationFn: ({ userId, payload, addressId }) =>
      dataClient.saveAddress(session, userId, payload, addressId),
    onSuccess: () => {
      refresh();
      setAddressModal(null);
      setToast("Endereço salvo com sucesso.");
    },
    onError: (reason) => setToast(reason.message),
  });
  const deleteAddress = useMutation({
    mutationFn: ({ userId, addressId }) =>
      dataClient.deleteAddress(session, userId, addressId),
    onSuccess: () => {
      refresh();
      setDeleteTarget(null);
      setToast("Endereço removido.");
    },
    onError: (reason) => setToast(reason.message),
  });
  const stats = useMemo(
    () => ({
      users: users.length,
      addresses: users.reduce((sum, user) => sum + user.addresses.length, 0),
      cities: new Set(
        users.flatMap((user) => user.addresses.map((address) => address.city)),
      ).size,
    }),
    [users],
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">Workspace principal</div>
        <nav className="nav-list" aria-label="Navegação principal">
          <NavItem
            active={active === "overview"}
            onClick={() => setActive("overview")}
            icon="⌂"
          >
            Visão geral
          </NavItem>
          {isAdmin && (
            <NavItem
              active={active === "users"}
              onClick={() => setActive("users")}
              icon="◎"
            >
              Usuários
            </NavItem>
          )}
          <NavItem
            active={active === "addresses"}
            onClick={() => setActive("addresses")}
            icon="⌖"
          >
            Endereços
          </NavItem>
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-dot" /> ViaCEP disponível{" "}
            <small>Consultas em cache nesta sessão</small>
          </div>
          <div className="profile">
            <div className="avatar avatar-small">
              {initials(currentUser.name)}
            </div>
            <div>
              <b>{currentUser.name}</b>
              <span>{isAdmin ? "Administradora" : "Usuário comum"}</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main-content" id="conteudo">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <i>/</i>
            <b>
              {active === "overview"
                ? "Visão geral"
                : active === "users"
                  ? "Usuários"
                  : "Endereços"}
            </b>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notificações">
              ♧<span className="notification-dot" />
            </button>
            <button
              className="user-chip"
              onClick={onLogout}
              aria-label="Sair da conta"
            >
              <div className="avatar avatar-small">
                {initials(currentUser.name)}
              </div>
              <span>Sair</span>
              <span className="chevron">⌄</span>
            </button>
          </div>
        </header>
        <div className="page-body">
          {error && <InlineError message={error.message} />}
          {active === "overview" && (
            <Overview
              stats={stats}
              users={users}
              isAdmin={isAdmin}
              onAddUser={() => setUserModal(true)}
              onSelect={(id) => {
                setSelectedUserId(id);
                setActive(isAdmin ? "users" : "addresses");
              }}
            />
          )}
          {active === "users" && isAdmin && (
            <UsersPage
              users={users}
              selectedUser={selectedUser}
              loading={isLoading}
              onSelect={setSelectedUserId}
              onAddUser={() => setUserModal(true)}
              onAddAddress={(userId) => setAddressModal({ userId })}
            />
          )}
          {active === "addresses" && (
            <AddressesPage
              users={users}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onAdd={(userId) => setAddressModal({ userId })}
              onEdit={(userId, address) => setAddressModal({ userId, address })}
              onDelete={(userId, address) =>
                setDeleteTarget({ userId, address })
              }
            />
          )}
        </div>
      </main>
      {userModal && (
        <UserModal
          pending={createUser.isPending}
          onClose={() => setUserModal(false)}
          onSubmit={(payload) => createUser.mutateAsync(payload)}
        />
      )}
      {addressModal && (
        <AddressModal
          users={users}
          isAdmin={isAdmin}
          modal={addressModal}
          pending={saveAddress.isPending}
          onClose={() => setAddressModal(null)}
          onSubmit={(data) => saveAddress.mutate(data)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          name={`${deleteTarget.address.street}, ${deleteTarget.address.number}`}
          pending={deleteAddress.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() =>
            deleteAddress.mutate({
              userId: deleteTarget.userId,
              addressId: deleteTarget.address.id,
            })
          }
        />
      )}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toast && (
          <div className="toast">
            <span>✓</span>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, children }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-icon" aria-hidden="true">
        {icon}
      </span>
      {children}
      {active && <span className="nav-active-dot" />}
    </button>
  );
}
function Overview({ stats, users, isAdmin, onAddUser, onSelect }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">PAINEL DE CONTROLE</span>
          <h1>Dados de endereço, em ordem.</h1>
          <p>Uma visão segura e direta dos cadastros do workspace.</p>
        </div>
        {isAdmin && (
          <Button onClick={onAddUser}>
            <span>+</span> Novo usuário
          </Button>
        )}
      </div>
      <section className="stat-grid">
        <Stat
          label="Usuários visíveis"
          value={stats.users}
          note={isAdmin ? "Gestão administrativa" : "Seu cadastro"}
          tone="blue"
          icon="◎"
        />
        <Stat
          label="Endereços"
          value={stats.addresses}
          note="Dados organizados"
          tone="amber"
          icon="⌖"
        />
        <Stat
          label="Cidades"
          value={stats.cities}
          note="Cobertura atual"
          tone="mint"
          icon="✧"
        />
      </section>
      <section className="content-grid">
        <div className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ACESSO RÁPIDO</span>
              <h2>Cadastros recentes</h2>
            </div>
            {isAdmin && (
              <Button variant="text" onClick={() => onSelect(users[0]?.id)}>
                Ver usuários <span>→</span>
              </Button>
            )}
          </div>
          <div className="user-list">
            {users.slice(0, 3).map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onClick={() => onSelect(user.id)}
              />
            ))}
          </div>
        </div>
        <div className="panel insight-panel">
          <div className="insight-shape" aria-hidden="true">
            ⌖
          </div>
          <span className="eyebrow">QUALIDADE DOS DADOS</span>
          <h2>Um endereço para cada jornada.</h2>
          <p>
            Os dados de localização ficam disponíveis para atender cada pessoa
            com contexto.
          </p>
          <div className="progress">
            <div
              style={{ width: `${Math.min(100, 25 + stats.addresses * 18)}%` }}
            />
          </div>
          <small>
            {stats.addresses
              ? "Cobertura de endereços em andamento"
              : "Adicione o primeiro endereço"}
          </small>
        </div>
      </section>
    </>
  );
}
function Stat({ label, value, note, tone, icon }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon" aria-hidden="true">
          {icon}
        </div>
      </div>
      <strong>{value}</strong>
      <small>
        <span className="trend">↗</span> {note}
      </small>
    </div>
  );
}
function UserRow({ user, onClick }) {
  return (
    <button className="user-row" onClick={onClick}>
      <div className="avatar">{initials(user.name)}</div>
      <div className="user-row-main">
        <b>{user.name}</b>
        <span>{user.cpf}</span>
      </div>
      <span className={`role-badge ${user.role === "ADMIN" ? "admin" : ""}`}>
        {user.role === "ADMIN" ? "Admin" : "Usuário"}
      </span>
      <span className="row-arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}
function UsersPage({
  users,
  selectedUser,
  loading,
  onSelect,
  onAddUser,
  onAddAddress,
}) {
  const [term, setTerm] = useState("");
  const visible = users.filter((user) =>
    `${user.name} ${user.cpf}`
      .toLocaleLowerCase()
      .includes(term.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="page-intro compact">
        <div>
          <span className="eyebrow">CONTROLE DE ACESSO</span>
          <h1>Usuários</h1>
          <p>Gerencie as pessoas que fazem parte do workspace.</p>
        </div>
        <Button onClick={onAddUser}>
          <span>+</span> Novo usuário
        </Button>
      </div>
      <div className="users-layout">
        <div className="panel users-panel">
          <div className="toolbar">
            <label className="search">
              <span aria-hidden="true">⌕</span>
              <input
                name="user-search"
                autoComplete="off"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Buscar por nome ou CPF…"
                aria-label="Buscar usuário"
              />
            </label>
          </div>
          {loading ? (
            <div className="empty-state">Carregando usuários…</div>
          ) : (
            <div className="user-list">
              {visible.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onClick={() => onSelect(user.id)}
                />
              ))}
              {!visible.length && (
                <div className="empty-state">Nenhum usuário encontrado.</div>
              )}
            </div>
          )}
        </div>
        {selectedUser && (
          <UserDetail
            user={selectedUser}
            onAddAddress={() => onAddAddress(selectedUser.id)}
          />
        )}
      </div>
    </>
  );
}
function UserDetail({ user, onAddAddress }) {
  return (
    <div className="panel detail-panel">
      <div className="detail-header">
        <div className="avatar avatar-large">{initials(user.name)}</div>
        <div>
          <h2>{user.name}</h2>
          <p>
            {user.role === "ADMIN" ? "Administradora" : "Usuário comum"} ·{" "}
            {user.cpf}
          </p>
        </div>
      </div>
      <div className="detail-meta">
        <div>
          <span>Data de nascimento</span>
          <b>
            {new Intl.DateTimeFormat("pt-BR").format(
              new Date(`${user.birthDate}T12:00:00`),
            )}
          </b>
        </div>
        <div>
          <span>Endereços</span>
          <b>{user.addresses.length} cadastrados</b>
        </div>
      </div>
      <div className="address-heading">
        <div>
          <span className="eyebrow">CADASTRO</span>
          <h3>Endereços vinculados</h3>
        </div>
        <Button variant="secondary" onClick={onAddAddress}>
          + Adicionar
        </Button>
      </div>
      {user.addresses.length ? (
        <div className="address-stack">
          {user.addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      ) : (
        <div className="empty-address">
          <span aria-hidden="true">⌖</span>
          <b>Nenhum endereço cadastrado</b>
          <small>Adicione o primeiro endereço deste usuário.</small>
          <Button variant="text" onClick={onAddAddress}>
            Adicionar endereço →
          </Button>
        </div>
      )}
    </div>
  );
}
function AddressCard({ address }) {
  return (
    <div className="address-card">
      <div className="address-pin" aria-hidden="true">
        ⌖
      </div>
      <div>
        <b>
          {address.street}, {address.number}
        </b>
        <span>
          {address.neighborhood} · {address.city}/{address.state} ·{" "}
          {address.cep}
        </span>
      </div>
      {address.primary && <span className="primary-label">Principal</span>}
    </div>
  );
}
function AddressesPage({
  users,
  currentUser,
  isAdmin,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [term, setTerm] = useState(() => readUrlParam("addressSearch"));
  const [state, setState] = useState(() => readUrlParam("state"));
  useEffect(() => {
    writeUrlParams({ addressSearch: term, state });
  }, [term, state]);
  const addresses = users
    .flatMap((user) => user.addresses.map((address) => ({ ...address, user })))
    .filter((address) =>
      `${address.street} ${address.city} ${address.cep} ${address.user.name}`
        .toLocaleLowerCase()
        .includes(term.toLocaleLowerCase()),
    )
    .filter((address) => !state || address.state === state);
  const states = [
    ...new Set(
      users.flatMap((user) => user.addresses.map((address) => address.state)),
    ),
  ].sort();
  return (
    <>
      <div className="page-intro compact">
        <div>
          <span className="eyebrow">BASE DE ENDEREÇOS</span>
          <h1>Endereços</h1>
          <p>
            {isAdmin
              ? "Uma visão segura de todos os pontos cadastrados."
              : "Edite apenas os seus próprios endereços."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => onAdd(users[0]?.id)}>
            <span>+</span> Novo endereço
          </Button>
        )}
      </div>
      <div className="panel table-panel">
        <div className="toolbar">
          <label className="search">
            <span aria-hidden="true">⌕</span>
            <input
              name="address-search"
              autoComplete="off"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Buscar por cidade, CEP ou usuário…"
              aria-label="Buscar endereço"
            />
          </label>
          <select
            className="filter-button"
            value={state}
            onChange={(event) => setState(event.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos os estados</option>
            {states.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Endereço</th>
                <th>Usuário</th>
                <th>CEP</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {addresses.map(({ user, ...address }) => (
                <tr key={address.id}>
                  <td data-label="Endereço">
                    <b>
                      {address.street}, {address.number}
                    </b>
                    <span>
                      {address.neighborhood} · {address.city}/{address.state}
                    </span>
                  </td>
                  <td data-label="Usuário">
                    <div className="table-user">
                      <div className="avatar avatar-tiny">
                        {initials(user.name)}
                      </div>
                      {user.name}
                    </div>
                  </td>
                  <td data-label="CEP">{address.cep}</td>
                  <td data-label="Status">
                    <span
                      className={`status-dot ${address.primary ? "primary" : ""}`}
                    >
                      {address.primary ? "Principal" : "Secundário"}
                    </span>
                  </td>
                  <td data-label="Ações">
                    <div className="row-actions">
                      <button
                        onClick={() => onEdit(user.id, address)}
                        aria-label={`Editar endereço de ${user.name}`}
                      >
                        ✎
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => onDelete(user.id, address)}
                          aria-label={`Excluir endereço de ${user.name}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!addresses.length && (
            <div className="empty-state">
              Nenhum endereço corresponde aos filtros.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function UserModal({ pending, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    birthDate: "",
    password: "",
    role: "USER",
  });
  const [error, setError] = useState("");
  const [cpfError, setCpfError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    setCpfError("");
    if (!form.name)
      return showValidationError(
        setError,
        "Informe o nome completo.",
        '[name="name"]',
      );
    if (!isValidCpf(form.cpf)) {
      showValidationError(
        setCpfError,
        "Informe um CPF válido.",
        '[name="cpf"]',
      );
      return;
    }
    if (!form.birthDate)
      return showValidationError(
        setError,
        "Informe a data de nascimento.",
        '[name="birthDate"]',
      );
    if (form.password.length < 8)
      return showValidationError(
        setError,
        "A senha precisa ter pelo menos 8 caracteres.",
        '[name="new-password"]',
      );
    try {
      await onSubmit({ ...form, cpf: formatCpf(form.cpf) });
    } catch (reason) {
      if (/CPF/i.test(reason.message)) {
        showValidationError(
          setCpfError,
          reason.message === "CPF já cadastrado"
            ? "Este CPF já está cadastrado. Confira o número ou use outro CPF."
            : reason.message,
          '[name="cpf"]',
        );
      } else {
        setError(reason.message);
      }
    }
  }
  return (
    <Modal title="Novo usuário" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-intro">
          Crie um acesso com o perfil adequado para a pessoa.
        </p>
        <Field label="Nome completo" required>
          <input
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ex.: Marina Costa"
          />
        </Field>
        <div className="form-grid">
          <Field label="CPF" required>
            <input
              name="cpf"
              inputMode="numeric"
              autoComplete="off"
              value={form.cpf}
              onChange={(event) => {
                setCpfError("");
                setForm({ ...form, cpf: formatCpf(event.target.value) });
              }}
              aria-invalid={Boolean(cpfError)}
              aria-describedby={cpfError ? "cpf-error" : undefined}
              placeholder="000.000.000-00"
            />
            {cpfError && (
              <small id="cpf-error" className="field-error" role="alert">
                {cpfError}
              </small>
            )}
          </Field>
          <Field label="Data de nascimento" required>
            <input
              name="birthDate"
              type="date"
              autoComplete="bday"
              value={form.birthDate}
              onChange={(event) =>
                setForm({ ...form, birthDate: event.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Senha de acesso" required>
          <input
            name="new-password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            placeholder="Mínimo de 8 caracteres"
          />
        </Field>
        <Field label="Perfil">
          <select
            name="role"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
          >
            <option value="USER">Usuário comum</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Criando…" : "Criar usuário"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function AddressModal({ users, isAdmin, modal, pending, onClose, onSubmit }) {
  const existing = modal.address || {};
  const [userId, setUserId] = useState(modal.userId);
  const [form, setForm] = useState({
    cep: existing.cep || "",
    number: existing.number || "",
    complement: existing.complement || "",
    street: existing.street || "",
    neighborhood: existing.neighborhood || "",
    city: existing.city || "",
    state: existing.state || "",
    primary: existing.primary || false,
  });
  const [lookup, setLookup] = useState(false);
  const [error, setError] = useState("");
  const lookupIdRef = useRef(0);
  async function lookupCep(value = form.cep) {
    const lookupId = ++lookupIdRef.current;
    const digits = value.replace(/\D/g, "");
    setLookup(true);
    setError("");
    try {
      const address = await dataClient.lookupCep(value);
      if (lookupId !== lookupIdRef.current) return;
      setForm((current) =>
        current.cep.replace(/\D/g, "") === digits
          ? { ...current, ...address }
          : current,
      );
    } catch (reason) {
      if (lookupId === lookupIdRef.current)
        showValidationError(setError, reason.message, '[name="cep"]');
    } finally {
      if (lookupId === lookupIdRef.current) setLookup(false);
    }
  }
  function changeCep(value) {
    const nextCep = formatCep(value);
    const nextDigits = nextCep.replace(/\D/g, "");
    const previousDigits = form.cep.replace(/\D/g, "");
    lookupIdRef.current += 1;
    setLookup(false);
    setError("");
    setForm((current) => ({
      ...current,
      cep: nextCep,
      ...(nextDigits !== current.cep.replace(/\D/g, "")
        ? { street: "", neighborhood: "", city: "", state: "" }
        : {}),
    }));
    if (nextDigits.length === 8 && nextDigits !== previousDigits)
      lookupCep(nextCep);
  }
  function submit(event) {
    event.preventDefault();
    if (
      !form.cep ||
      !form.street ||
      !form.neighborhood ||
      !form.city ||
      !form.state
    )
      return showValidationError(
        setError,
        "Consulte um CEP válido antes de salvar.",
        '[name="cep"]',
      );
    if (!form.number)
      return showValidationError(
        setError,
        "Informe o número do endereço.",
        '[name="address-number"]',
      );
    onSubmit({
      userId: Number(userId),
      payload: { ...form, cep: formatCep(form.cep) },
      addressId: existing.id,
    });
  }
  return (
    <Modal
      title={existing.id ? "Editar endereço" : "Novo endereço"}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <p className="modal-intro">
          Ao completar os 8 dígitos do CEP, o local é preenchido
          automaticamente. A consulta é reutilizada nesta sessão.
        </p>
        <Field label="Usuário">
          <select
            name="address-user"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={!isAdmin || Boolean(existing.id)}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="cep-row">
          <Field label="CEP" required>
            <input
              name="cep"
              inputMode="numeric"
              autoComplete="postal-code"
              value={form.cep}
              onChange={(event) => changeCep(event.target.value)}
              placeholder="00000-000"
            />
          </Field>
          <Button
            variant="secondary"
            className="lookup-button"
            onClick={() => lookupCep()}
            disabled={lookup}
          >
            {lookup ? "Consultando…" : "Consultar CEP"}
          </Button>
        </div>
        <div className="form-grid">
          <Field label="Número" required>
            <input
              name="address-number"
              inputMode="numeric"
              autoComplete="address-line2"
              value={form.number}
              onChange={(event) =>
                setForm({ ...form, number: event.target.value })
              }
              placeholder="Ex.: 1578"
            />
          </Field>
          <Field label="Complemento">
            <input
              name="complement"
              autoComplete="address-line2"
              value={form.complement}
              onChange={(event) =>
                setForm({ ...form, complement: event.target.value })
              }
              placeholder="Apto, sala…"
            />
          </Field>
        </div>
        <div className="location-preview" aria-live="polite">
          <span aria-hidden="true">⌖</span>
          <div>
            <b>{form.street || "O logradouro aparecerá aqui"}</b>
            <small>
              {form.neighborhood
                ? `${form.neighborhood} · ${form.city}/${form.state}`
                : lookup
                  ? "Consultando CEP…"
                  : "Informe um CEP válido para preencher"}
            </small>
          </div>
        </div>
        <label className="checkbox-row">
          <input
            name="primary"
            type="checkbox"
            checked={form.primary}
            onChange={(event) =>
              setForm({ ...form, primary: event.target.checked })
            }
          />{" "}
          Definir como endereço principal
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar endereço"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function ConfirmDialog({ name, pending, onClose, onConfirm }) {
  return (
    <Modal title="Excluir endereço" onClose={onClose}>
      <p className="modal-intro">
        Você está prestes a excluir <b>{name}</b>. Esta ação não pode ser
        desfeita.
      </p>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Excluindo…" : "Excluir endereço"}
        </Button>
      </div>
    </Modal>
  );
}
function Field({ label, required, children }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {children}
    </label>
  );
}
function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const focusable = () => [
      ...(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) || []),
    ];
    const focusInitial = () => focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const timer = window.setTimeout(focusInitial, 0);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">ATLAS</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function InlineError({ message }) {
  return (
    <p className="form-error page-error" role="alert">
      {message}
    </p>
  );
}
function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}
createRoot(document.getElementById("root")).render(
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </AppErrorBoundary>,
);
