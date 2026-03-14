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
    // id is empty
    if (!user.id) throw new Error('User must have an id');
    // user alreasdy exists
    if (this.getUser(user.id)) throw new Error(`User with id ${user.id} already exists`);

    this.users.set(user.id, user);
  }

  removeUser(id: string): void {
    //user not found
    if (!this.getUser(id)) throw new Error(`User with id ${id} not found`);
    //found and delete now
    this.users.delete(id);
  }

  getUser(id: string): User | null {
    return this.users.get(id) || null;
  }

  getUsersByEmail(email: string): User[] {
    //email is not empty
    if (!email) throw new Error('Email must be provided');
    //find users with the email. might be or might not be unique
    const users = Array.from(this.users.values()).filter(user => user.email === email);
    if(users.length > 0) {
      return users;
    } else {
      return [];
    }
  }

  getUsersByPhone(phone: string): User[] {
    //we are given a phone and we need to find everyon e who uses the same phone
    if (!phone) throw new Error('Phone must be provided');
    
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
