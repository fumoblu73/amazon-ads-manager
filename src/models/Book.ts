// ================================================
// MODEL: BOOK
// ================================================
// Rappresenta un libro nel database
// Contiene i dati necessari per calcolare il FAST ACoS

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate } from 'typeorm';

@Entity('books')
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  asin: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'printing_cost' })
  printingCost: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 60, name: 'royalty_percentage' })
  royaltyPercentage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'fast_acos' })
  fastAcos: number;

  @Column({ type: 'varchar', length: 10 })
  marketplace: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Hook per calcolare automaticamente FAST ACoS prima di salvare
  @BeforeInsert()
  @BeforeUpdate()
  calculateFastAcos() {
    const royalty = (this.royaltyPercentage / 100 * this.price) - this.printingCost;
    this.fastAcos = Math.round((royalty / (this.price * 1.22)) * 10000) / 100;
  }
}

// Interfaccia per creare un nuovo libro
export interface CreateBookInput {
  asin: string;
  title: string;
  price: number;
  printingCost: number;
  royaltyPercentage?: number; // Default 60%
  marketplace: string;
}

// Interfaccia per aggiornare un libro
export interface UpdateBookInput {
  title?: string;
  price?: number;
  printingCost?: number;
  royaltyPercentage?: number;
}

/**
 * Classe Book per gestire la logica di business
 */
export class BookModel {
  /**
   * Calcola automaticamente il FAST ACoS
   */
  static calculateFastAcos(price: number, printingCost: number, royaltyPercentage: number = 60): number {
    // Royalty = (60% × Prezzo) - Costi di stampa
    const royalty = (royaltyPercentage / 100 * price) - printingCost;

    // FAST ACoS = Royalty / (Prezzo × 1.22)
    const fastAcos = (royalty / (price * 1.22)) * 100;

    return Math.round(fastAcos * 100) / 100; // Arrotonda a 2 decimali
  }

  /**
   * Valida i dati di un libro
   */
  static validate(bookData: CreateBookInput | UpdateBookInput): string[] {
    const errors: string[] = [];

    if ('price' in bookData && bookData.price !== undefined) {
      if (bookData.price <= 0) {
        errors.push('Il prezzo deve essere maggiore di 0');
      }
    }

    if ('printingCost' in bookData && bookData.printingCost !== undefined) {
      if (bookData.printingCost < 0) {
        errors.push('I costi di stampa non possono essere negativi');
      }
    }

    if ('royaltyPercentage' in bookData && bookData.royaltyPercentage !== undefined) {
      if (bookData.royaltyPercentage < 0 || bookData.royaltyPercentage > 100) {
        errors.push('La percentuale di royalty deve essere tra 0 e 100');
      }
    }

    if ('asin' in bookData) {
      if (!bookData.asin || bookData.asin.length !== 10) {
        errors.push('ASIN deve essere lungo 10 caratteri');
      }
    }

    return errors;
  }
}
