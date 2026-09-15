package com.atlas.api.web.dto;

import com.atlas.api.domain.UserRole;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public final class UserDtos {
    private UserDtos() {}
    public record CreateUserRequest(@NotBlank String name, @NotBlank String cpf, @NotNull LocalDate birthDate, @Size(min = 8) String password, UserRole role) {}
    public record AddressRequest(@NotBlank String cep, @NotBlank String number, String complement, @NotBlank String street, @NotBlank String neighborhood, @NotBlank String city, @NotBlank @Size(min = 2, max = 2) String state, boolean primary) {}
    public record AddressResponse(Long id, String cep, String number, String complement, String street, String neighborhood, String city, String state, boolean primary) {}
    public record UserResponse(Long id, String name, String cpf, LocalDate birthDate, UserRole role, List<AddressResponse> addresses) {}
    public record LoginRequest(@NotBlank String cpf, @NotBlank String password) {}
}
