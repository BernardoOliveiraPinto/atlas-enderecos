package com.atlas.api.repository;

import com.atlas.api.domain.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    boolean existsByCpf(String cpf);
    @EntityGraph(attributePaths = "addresses")
    java.util.List<User> findAll();
    @EntityGraph(attributePaths = "addresses")
    Optional<User> findById(Long id);
    Optional<User> findByCpf(String cpf);
}
