export class User {
  id: string;
  strEmail: string;
  strFirstName: string;
  strLastName: string;
  dateCreation: Date;
  dateModification: Date;

  constructor() {
    this.id = "";
    this.strEmail = "";
    this.strFirstName = "";
    this.strLastName = "";
    this.dateCreation = new Date();
    this.dateModification = new Date();
  }
}
