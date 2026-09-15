package com.atlas.api.service;

import com.atlas.api.domain.User;
import com.atlas.api.domain.UserRole;
import com.atlas.api.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class AccessControl {
    private final UserRepository users;
    public AccessControl(UserRepository users) { this.users = users; }

    public User currentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getName())) throw new SecurityException("Autenticação necessária");
        return users.findByCpf(authentication.getName()).orElseThrow(() -> new SecurityException("Usuário autenticado não encontrado"));
    }
    public void requireAdmin() { if (currentUser().getRole() != UserRole.ADMIN) throw new SecurityException("Apenas administradores podem realizar esta ação"); }
    public void requireSelfOrAdmin(Long userId) { User current = currentUser(); if (current.getRole() != UserRole.ADMIN && !current.getId().equals(userId)) throw new SecurityException("Você não pode acessar dados de outro usuário"); }
}
