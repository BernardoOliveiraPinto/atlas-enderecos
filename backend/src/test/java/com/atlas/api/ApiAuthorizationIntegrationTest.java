package com.atlas.api;

import com.atlas.api.domain.User;
import com.atlas.api.domain.UserRole;
import com.atlas.api.repository.UserRepository;
import com.atlas.api.repository.AddressRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;
import java.time.LocalDate;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiAuthorizationIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired AddressRepository addresses;
    @Autowired PasswordEncoder encoder;

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mvc.perform(get("/api/users")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginCreatesAServerSessionWithoutReturningThePassword() throws Exception {
        MvcResult login = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"cpf\":\"529.982.247-25\",\"password\":\"Atlas@123\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("ADMIN")).andExpect(jsonPath("$.password").doesNotExist()).andReturn();
        MockHttpSession session = (MockHttpSession) login.getRequest().getSession(false);
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Marina Costa"));
    }

    @Test
    void normalUserCannotListAllUsers() throws Exception {
        mvc.perform(get("/api/users").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("11144477735").roles("USER")))
            .andExpect(status().isForbidden());
    }

    @Test
    void administratorCanCreateUserAndCpfMustBeUnique() throws Exception {
        String payload = "{\"name\":\"Teste Admin\",\"cpf\":\"390.533.447-05\",\"birthDate\":\"1995-03-20\",\"password\":\"Senha@123\",\"role\":\"USER\"}";
        mvc.perform(post("/api/users").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("52998224725").roles("ADMIN")).contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.cpf").value("390.533.447-05"));
        mvc.perform(post("/api/users").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("52998224725").roles("ADMIN")).contentType(MediaType.APPLICATION_JSON).content(payload))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("CPF já cadastrado"));
    }

    @Test
    void invalidCepIsRejectedByTheApi() throws Exception {
        User user = users.findByCpf("11144477735").orElseThrow();
        String address = "{\"cep\":\"123\",\"number\":\"42\",\"street\":\"Rua de teste\",\"neighborhood\":\"Centro\",\"city\":\"São Paulo\",\"state\":\"SP\",\"primary\":true}";
        mvc.perform(post("/api/users/" + user.getId() + "/addresses")
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("52998224725").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(address))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("CEP inválido"));
    }

    @Test
    void deletingPrimaryAddressPromotesAnotherAddress() throws Exception {
        User user = new User(); user.setName("Usuário de teste"); user.setCpf("12345678909"); user.setBirthDate(LocalDate.of(1990, 1, 1)); user.setRole(UserRole.USER); user.setPasswordHash(encoder.encode("Senha@123")); user = users.save(user);
        String first = "{\"cep\":\"01310100\",\"number\":\"1\",\"street\":\"Avenida Paulista\",\"neighborhood\":\"Bela Vista\",\"city\":\"São Paulo\",\"state\":\"SP\",\"primary\":true}";
        String second = "{\"cep\":\"22041080\",\"number\":\"2\",\"street\":\"Rua Barão de Ipanema\",\"neighborhood\":\"Copacabana\",\"city\":\"Rio de Janeiro\",\"state\":\"RJ\",\"primary\":false}";
        var principal = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("52998224725").roles("ADMIN");
        mvc.perform(post("/api/users/" + user.getId() + "/addresses").with(principal).contentType(MediaType.APPLICATION_JSON).content(first)).andExpect(status().isCreated());
        mvc.perform(post("/api/users/" + user.getId() + "/addresses").with(principal).contentType(MediaType.APPLICATION_JSON).content(second)).andExpect(status().isCreated());
        Long firstAddressId = users.findById(user.getId()).orElseThrow().getAddresses().stream().filter(a -> a.isPrimaryAddress()).findFirst().orElseThrow().getId();
        mvc.perform(delete("/api/users/" + user.getId() + "/addresses/" + firstAddressId).with(principal)).andExpect(status().isNoContent());
        mvc.perform(get("/api/users/" + user.getId()).with(principal)).andExpect(status().isOk()).andExpect(jsonPath("$.addresses[0].primary").value(true));
    }

    @Test
    void normalUserCannotChangeAnotherUsersAddress() throws Exception {
        User user = new User(); user.setName("Outra pessoa"); user.setCpf("93541134780"); user.setBirthDate(LocalDate.of(1992, 5, 12)); user.setRole(UserRole.USER); user.setPasswordHash(encoder.encode("Senha@123")); user = users.save(user);
        String address = "{\"cep\":\"01310100\",\"number\":\"1578\",\"street\":\"Avenida Paulista\",\"neighborhood\":\"Bela Vista\",\"city\":\"São Paulo\",\"state\":\"SP\",\"primary\":true}";
        var admin = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("52998224725").roles("ADMIN");
        mvc.perform(post("/api/users/" + user.getId() + "/addresses").with(admin).contentType(MediaType.APPLICATION_JSON).content(address)).andExpect(status().isCreated());
        Long addressId = users.findById(user.getId()).orElseThrow().getAddresses().get(0).getId();
        mvc.perform(put("/api/users/" + user.getId() + "/addresses/" + addressId)
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("11144477735").roles("USER"))
                .contentType(MediaType.APPLICATION_JSON).content(address))
            .andExpect(status().isForbidden());
    }

    @Test
    void normalUserCannotCreateOrDeleteAddresses() throws Exception {
        User user = users.findByCpf("11144477735").orElseThrow();
        Long addressId = addresses.findAll().stream().filter(address -> address.getUser().getId().equals(user.getId())).findFirst().orElseThrow().getId();
        String address = "{\"cep\":\"01310100\",\"number\":\"1578\",\"street\":\"Avenida Paulista\",\"neighborhood\":\"Bela Vista\",\"city\":\"São Paulo\",\"state\":\"SP\",\"primary\":false}";
        var ordinaryUser = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("11144477735").roles("USER");
        mvc.perform(post("/api/users/" + user.getId() + "/addresses").with(ordinaryUser).contentType(MediaType.APPLICATION_JSON).content(address)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/users/" + user.getId() + "/addresses/" + addressId).with(ordinaryUser)).andExpect(status().isForbidden());
    }

    @Test
    void choosingANewPrimaryAddressUnsetsThePreviousOne() throws Exception {
        User user = new User(); user.setName("Regra principal"); user.setCpf("16899535009"); user.setBirthDate(LocalDate.of(1988, 8, 8)); user.setRole(UserRole.USER); user.setPasswordHash(encoder.encode("Senha@123")); user = users.save(user);
        String first = "{\"cep\":\"01310100\",\"number\":\"1578\",\"street\":\"Avenida Paulista\",\"neighborhood\":\"Bela Vista\",\"city\":\"São Paulo\",\"state\":\"SP\",\"primary\":true}";
        String second = "{\"cep\":\"22041080\",\"number\":\"42\",\"street\":\"Rua Barão de Ipanema\",\"neighborhood\":\"Copacabana\",\"city\":\"Rio de Janeiro\",\"state\":\"RJ\",\"primary\":true}";
        var admin = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("52998224725").roles("ADMIN");
        mvc.perform(post("/api/users/" + user.getId() + "/addresses").with(admin).contentType(MediaType.APPLICATION_JSON).content(first)).andExpect(status().isCreated());
        mvc.perform(post("/api/users/" + user.getId() + "/addresses").with(admin).contentType(MediaType.APPLICATION_JSON).content(second)).andExpect(status().isCreated());
        long primaryCount = users.findById(user.getId()).orElseThrow().getAddresses().stream().filter(address -> address.isPrimaryAddress()).count();
        org.assertj.core.api.Assertions.assertThat(primaryCount).isEqualTo(1);
    }

    @Test
    void normalUserCanChooseTheirOwnPrimaryAddress() throws Exception {
        User user = users.findByCpf("11144477735").orElseThrow();
        String second = "{\"cep\":\"01310100\",\"number\":\"10\",\"street\":\"Avenida Paulista\",\"neighborhood\":\"Bela Vista\",\"city\":\"São Paulo\",\"state\":\"SP\",\"primary\":false}";
        var admin = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("52998224725").roles("ADMIN");
        var ordinaryUser = org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("11144477735").roles("USER");
        mvc.perform(post("/api/users/" + user.getId() + "/addresses").with(admin).contentType(MediaType.APPLICATION_JSON).content(second))
            .andExpect(status().isCreated());
        Long secondAddressId = users.findById(user.getId()).orElseThrow().getAddresses().stream()
            .filter(address -> !address.isPrimaryAddress()).findFirst().orElseThrow().getId();
        String makePrimary = second.replace("\"primary\":false", "\"primary\":true");
        mvc.perform(put("/api/users/" + user.getId() + "/addresses/" + secondAddressId)
                .with(ordinaryUser).contentType(MediaType.APPLICATION_JSON).content(makePrimary))
            .andExpect(status().isOk());
        mvc.perform(get("/api/users/" + user.getId()).with(ordinaryUser))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.addresses[?(@.id == " + secondAddressId + ")].primary")
                .value(org.hamcrest.Matchers.hasItem(true)));
        long primaryCount = users.findById(user.getId()).orElseThrow().getAddresses().stream()
            .filter(address -> address.isPrimaryAddress()).count();
        org.assertj.core.api.Assertions.assertThat(primaryCount).isEqualTo(1);
    }
}
