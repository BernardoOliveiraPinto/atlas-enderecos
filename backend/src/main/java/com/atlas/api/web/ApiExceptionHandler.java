package com.atlas.api.web;

import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({IllegalArgumentException.class, EntityNotFoundException.class}) @ResponseStatus(HttpStatus.BAD_REQUEST) public Map<String, String> clientError(RuntimeException ex) { return Map.of("message", ex.getMessage()); }
    @ExceptionHandler(SecurityException.class) @ResponseStatus(HttpStatus.FORBIDDEN) public Map<String, String> forbidden(SecurityException ex) { return Map.of("message", ex.getMessage()); }
    @ExceptionHandler(AuthenticationException.class) @ResponseStatus(HttpStatus.UNAUTHORIZED) public Map<String, String> unauthorized(AuthenticationException ex) { return Map.of("message", "CPF ou senha inválidos"); }
}
