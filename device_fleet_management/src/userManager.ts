export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export class UserManager {

  private users: Map<string, User>;
  
  constructor() {
    this.users = new Map<string, User>();
  }

  addUser(user: User): void {
    if (!user.id) throw new Error('User must have an id');
    if (this.getUser(user.id)) throw new Error(`User with id ${user.id} already exists`);
    this.users.set(user.id, user);
  }

  removeUser(id: string): void {
    if (!this.getUser(id)) throw new Error(`User with id ${id} not found`);
    this.users.delete(id);
  }

  getUser(id: string): User | null {
    return this.users.get(id) || null;
  }

  getUsersByEmail(email: string): User[] {
    const users = Array.from(this.users.values()).filter(user => user.email === email);
    if(users.length > 0) {
      return users;
    } else {
      return [];
    }
  }

  getUsersByPhone(phone: string): User[] {
    const users = Array.from(this.users.values()).filter(user => user.phone === phone);
    if(users.length > 0) {
      return users;
    } else {
      return [];
    }
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getUserCount(): number {
    return this.users.size;
  }
}
