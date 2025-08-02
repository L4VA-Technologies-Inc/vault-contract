use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address, Inline, VerificationKey}
use cardano/transaction.{Transaction}

pub fn must_be_signed_by(transaction: Transaction, vk: VerificationKeyHash) {
  list.has(transaction.extra_signatories, vk)
}

pub fn is_admin(
  transaction: Transaction,
  admin_keyhash: VerificationKeyHash,
) -> Bool {
  must_be_signed_by(transaction, admin_keyhash)
}

pub fn is_signed_by(self: Transaction, address: Address) -> Bool {
  or {
    when address.stake_credential is {
      Some(Inline(VerificationKey(vkey))) ->
        list.has(self.extra_signatories, vkey)
      _ -> False
    },
    when address.payment_credential is {
      VerificationKey(vkey) -> list.has(self.extra_signatories, vkey)
      _ -> False
    },
  }
}
