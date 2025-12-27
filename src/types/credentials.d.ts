// Type declarations for Credential Management API
interface PasswordCredentialData {
  id: string;
  password: string;
  name?: string;
}

interface PasswordCredential extends Credential {
  password: string;
  name: string;
}

declare var PasswordCredential: {
  prototype: PasswordCredential;
  new(data: PasswordCredentialData): PasswordCredential;
};

interface CredentialRequestOptions {
  password?: boolean;
  mediation?: 'silent' | 'optional' | 'required';
}

interface Window {
  PasswordCredential?: typeof PasswordCredential;
}
