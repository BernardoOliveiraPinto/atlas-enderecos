package com.atlas.api.config;

import com.atlas.api.domain.Address;
import com.atlas.api.domain.User;
import com.atlas.api.domain.UserRole;
import com.atlas.api.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DemoDataConfig {
    @Bean
    CommandLineRunner loadDemoData(UserRepository users, PasswordEncoder encoder) {
        return args -> {
            if (users.count() > 0) return;
            User admin = createUser("Marina Costa", "52998224725", "1994-06-18", UserRole.ADMIN, encoder);
            admin.getAddresses().add(createAddress(admin, "01310100", "1578", "Apto 84", "Avenida Paulista", "Bela Vista", "São Paulo", "SP", true));
            User member = createUser("Rafael Nunes", "11144477735", "1991-03-09", UserRole.USER, encoder);
            member.getAddresses().add(createAddress(member, "22041080", "42", "", "Rua Anita Garibaldi", "Copacabana", "Rio de Janeiro", "RJ", true));
            users.save(admin);
            users.save(member);
        };
    }

    private User createUser(String name, String cpf, String birthDate, UserRole role, PasswordEncoder encoder) {
        User user = new User(); user.setName(name); user.setCpf(cpf); user.setBirthDate(java.time.LocalDate.parse(birthDate)); user.setRole(role); user.setPasswordHash(encoder.encode("Atlas@123")); return user;
    }
    private Address createAddress(User user, String cep, String number, String complement, String street, String neighborhood, String city, String state, boolean primary) {
        Address address = new Address(); address.setUser(user); address.setCep(cep); address.setNumber(number); address.setComplement(complement); address.setStreet(street); address.setNeighborhood(neighborhood); address.setCity(city); address.setState(state); address.setPrimaryAddress(primary); return address;
    }
}
