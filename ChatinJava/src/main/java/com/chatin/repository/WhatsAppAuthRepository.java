package com.chatin.repository;

import com.chatin.model.WhatsAppAuth;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WhatsAppAuthRepository extends MongoRepository<WhatsAppAuth, String> {
    Optional<WhatsAppAuth> findByAccountId(String accountId);
    Optional<WhatsAppAuth> findFirstByAccountId(String accountId);
    void deleteByAccountId(String accountId);
}
