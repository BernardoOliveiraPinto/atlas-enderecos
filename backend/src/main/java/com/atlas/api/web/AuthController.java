package com.atlas.api.web;

import com.atlas.api.service.AccessControl;
import com.atlas.api.service.UserService;
import com.atlas.api.web.dto.UserDtos.LoginRequest;
import com.atlas.api.web.dto.UserDtos.UserResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AccessControl accessControl;
    private final UserService userService;
    private final AuthenticationManager authenticationManager;
    public AuthController(AccessControl accessControl, UserService userService, AuthenticationManager authenticationManager) { this.accessControl = accessControl; this.userService = userService; this.authenticationManager = authenticationManager; }
    @PostMapping("/login") public UserResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        var authentication = authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.cpf().replaceAll("\\D", ""), request.password()));
        SecurityContext context = SecurityContextHolder.createEmptyContext(); context.setAuthentication(authentication); SecurityContextHolder.setContext(context);
        servletRequest.getSession(true).setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        return userService.find(accessControl.currentUser().getId());
    }
    @PostMapping("/logout") public void logout(HttpServletRequest request) { var session = request.getSession(false); if (session != null) session.invalidate(); SecurityContextHolder.clearContext(); }
    @GetMapping("/me") public UserResponse me() { return userService.find(accessControl.currentUser().getId()); }
}
