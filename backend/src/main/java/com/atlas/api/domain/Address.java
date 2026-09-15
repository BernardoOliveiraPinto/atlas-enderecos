package com.atlas.api.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "addresses")
@Getter @Setter @NoArgsConstructor
public class Address {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 8) private String cep;
    @Column(nullable = false) private String number;
    private String complement;
    @Column(nullable = false) private String street;
    @Column(nullable = false) private String neighborhood;
    @Column(nullable = false) private String city;
    @Column(nullable = false, length = 2) private String state;
    @Column(nullable = false) private boolean primaryAddress;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id") private User user;
}
