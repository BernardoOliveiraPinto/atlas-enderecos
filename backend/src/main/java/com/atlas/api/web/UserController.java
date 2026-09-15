package com.atlas.api.web;

import com.atlas.api.service.UserService;
import com.atlas.api.web.dto.UserDtos.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/users")
public class UserController {
    private final UserService service;
    public UserController(UserService service) { this.service = service; }
    @GetMapping public List<UserResponse> list() { return service.list(); }
    @GetMapping("/{id}") public UserResponse find(@PathVariable Long id) { return service.find(id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public UserResponse create(@Valid @RequestBody CreateUserRequest request) { return service.create(request); }
    @PostMapping("/{userId}/addresses") @ResponseStatus(HttpStatus.CREATED) public UserResponse createAddress(@PathVariable Long userId, @Valid @RequestBody AddressRequest request) { return service.saveAddress(userId, null, request); }
    @PutMapping("/{userId}/addresses/{addressId}") public UserResponse updateAddress(@PathVariable Long userId, @PathVariable Long addressId, @Valid @RequestBody AddressRequest request) { return service.saveAddress(userId, addressId, request); }
    @DeleteMapping("/{userId}/addresses/{addressId}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteAddress(@PathVariable Long userId, @PathVariable Long addressId) { service.deleteAddress(userId, addressId); }
}
