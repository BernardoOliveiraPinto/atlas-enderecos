package com.atlas.api.service;

import com.atlas.api.domain.Address;
import com.atlas.api.domain.User;
import com.atlas.api.domain.UserRole;
import com.atlas.api.repository.AddressRepository;
import com.atlas.api.repository.UserRepository;
import com.atlas.api.web.dto.UserDtos.*;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class UserService {
    private final UserRepository users;
    private final AddressRepository addresses;
    private final PasswordEncoder passwordEncoder;
    private final AccessControl accessControl;

    public UserService(UserRepository users, AddressRepository addresses, PasswordEncoder passwordEncoder, AccessControl accessControl) {
        this.users = users; this.addresses = addresses; this.passwordEncoder = passwordEncoder; this.accessControl = accessControl;
    }

    @Transactional public UserResponse create(CreateUserRequest request) {
        accessControl.requireAdmin();
        String cpf = digits(request.cpf());
        if (cpf.length() != 11 || !validCpf(cpf)) throw new IllegalArgumentException("CPF inválido");
        if (users.existsByCpf(cpf)) throw new IllegalArgumentException("CPF já cadastrado");
        User user = new User(); user.setName(request.name().trim()); user.setCpf(cpf); user.setBirthDate(request.birthDate()); user.setRole(request.role() == null ? UserRole.USER : request.role()); user.setPasswordHash(passwordEncoder.encode(request.password()));
        return toResponse(users.save(user));
    }
    @Transactional public List<UserResponse> list() { accessControl.requireAdmin(); return users.findAll().stream().map(this::toResponse).toList(); }
    @Transactional public UserResponse find(Long id) { accessControl.requireSelfOrAdmin(id); return toResponse(getUser(id)); }
    @Transactional public UserResponse saveAddress(Long userId, Long addressId, AddressRequest request) {
        if (addressId == null) accessControl.requireAdmin(); else accessControl.requireSelfOrAdmin(userId);
        User user = getUser(userId); Address address = addressId == null ? new Address() : addresses.findById(addressId).orElseThrow(() -> new EntityNotFoundException("Endereço não encontrado"));
        if (address.getUser() != null && !address.getUser().getId().equals(userId)) throw new SecurityException("Acesso negado");
        address.setUser(user); address.setCep(digits(request.cep())); address.setNumber(request.number()); address.setComplement(request.complement()); address.setStreet(request.street()); address.setNeighborhood(request.neighborhood()); address.setCity(request.city()); address.setState(request.state().toUpperCase());
        if (!user.getAddresses().contains(address)) user.getAddresses().add(address);
        boolean wasPrimary = address.isPrimaryAddress();
        if (request.primary()) {
            user.getAddresses().forEach(item -> item.setPrimaryAddress(false));
            address.setPrimaryAddress(true);
        } else if (wasPrimary && user.getAddresses().size() > 1) {
            address.setPrimaryAddress(false);
            user.getAddresses().stream().filter(item -> item != address).findFirst().ifPresent(item -> item.setPrimaryAddress(true));
        } else if (user.getAddresses().stream().noneMatch(Address::isPrimaryAddress)) {
            address.setPrimaryAddress(true);
        } else {
            address.setPrimaryAddress(false);
        }
        addresses.save(address); return toResponse(user);
    }
    @Transactional public void deleteAddress(Long userId, Long addressId) { accessControl.requireAdmin(); User user = getUser(userId); Address address = addresses.findById(addressId).orElseThrow(() -> new EntityNotFoundException("Endereço não encontrado")); if (!address.getUser().getId().equals(userId)) throw new SecurityException("Acesso negado"); boolean wasPrimary = address.isPrimaryAddress(); user.getAddresses().remove(address); addresses.delete(address); if (wasPrimary && !user.getAddresses().isEmpty()) { user.getAddresses().forEach(item -> item.setPrimaryAddress(false)); user.getAddresses().get(0).setPrimaryAddress(true); } }
    private User getUser(Long id) { return users.findById(id).orElseThrow(() -> new EntityNotFoundException("Usuário não encontrado")); }
    private UserResponse toResponse(User user) { return new UserResponse(user.getId(), user.getName(), maskCpf(user.getCpf()), user.getBirthDate(), user.getRole(), user.getAddresses().stream().map(a -> new AddressResponse(a.getId(), maskCep(a.getCep()), a.getNumber(), a.getComplement(), a.getStreet(), a.getNeighborhood(), a.getCity(), a.getState(), a.isPrimaryAddress())).toList()); }
    private static String digits(String value) { return value == null ? "" : value.replaceAll("\\D", ""); }
    private static String maskCpf(String cpf) { return cpf.length() == 11 ? cpf.substring(0,3)+"."+cpf.substring(3,6)+"."+cpf.substring(6,9)+"-"+cpf.substring(9) : cpf; }
    private static String maskCep(String cep) { return cep.length() == 8 ? cep.substring(0,5)+"-"+cep.substring(5) : cep; }
    private static boolean validCpf(String cpf) { if (cpf.chars().distinct().count() == 1) return false; int sum=0; for(int i=0;i<9;i++) sum += (cpf.charAt(i)-48)*(10-i); int d1=(sum*10)%11; if(d1==10)d1=0; if(d1 != cpf.charAt(9)-48)return false; sum=0; for(int i=0;i<10;i++) sum+=(cpf.charAt(i)-48)*(11-i); int d2=(sum*10)%11; if(d2==10)d2=0; return d2 == cpf.charAt(10)-48; }
}
