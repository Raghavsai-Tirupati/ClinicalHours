export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_deletion_events: {
        Row: {
          deleted_at: string
          email: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          deleted_at?: string
          email?: string | null
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          deleted_at?: string
          email?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action_type: string
          actor_email: string
          created_at: string
          hospital_page_id: string | null
          id: string
          metadata: Json | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          actor_email: string
          created_at?: string
          hospital_page_id?: string | null
          id?: string
          metadata?: Json | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          actor_email?: string
          created_at?: string
          hospital_page_id?: string | null
          id?: string
          metadata?: Json | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_log_hospital_page_id_fkey"
            columns: ["hospital_page_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_notification_log: {
        Row: {
          admin_email: string
          applicant_email: string | null
          applicant_name: string | null
          hospital_name: string
          hospital_page_id: string | null
          id: string
          position_title: string | null
          sent_at: string
          status: string
        }
        Insert: {
          admin_email: string
          applicant_email?: string | null
          applicant_name?: string | null
          hospital_name: string
          hospital_page_id?: string | null
          id?: string
          position_title?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          admin_email?: string
          applicant_email?: string | null
          applicant_name?: string | null
          hospital_name?: string
          hospital_page_id?: string | null
          id?: string
          position_title?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_log_hospital_page_id_fkey"
            columns: ["hospital_page_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      application_answers: {
        Row: {
          answer_file_url: string | null
          answer_options: Json | null
          answer_text: string | null
          application_id: string
          created_at: string | null
          id: string
          question_id: string
        }
        Insert: {
          answer_file_url?: string | null
          answer_options?: Json | null
          answer_text?: string | null
          application_id: string
          created_at?: string | null
          id?: string
          question_id: string
        }
        Update: {
          answer_file_url?: string | null
          answer_options?: Json | null
          answer_text?: string | null
          application_id?: string
          created_at?: string | null
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "position_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          file_name: string
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          student_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          file_name: string
          file_size_bytes?: number | null
          file_type?: string
          file_url: string
          id?: string
          student_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_links: {
        Row: {
          application_url: string | null
          confidence: string | null
          created_at: string | null
          hospital_name: string
          hospital_name_lower: string | null
          hospital_website: string | null
          id: string
          last_searched_at: string | null
          search_query: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          application_url?: string | null
          confidence?: string | null
          created_at?: string | null
          hospital_name: string
          hospital_name_lower?: string | null
          hospital_website?: string | null
          id?: string
          last_searched_at?: string | null
          search_query?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          application_url?: string | null
          confidence?: string | null
          created_at?: string | null
          hospital_name?: string
          hospital_name_lower?: string | null
          hospital_website?: string | null
          id?: string
          last_searched_at?: string | null
          search_query?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      application_notes: {
        Row: {
          application_id: string
          body: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          body: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          essay_responses: Json | null
          id: string
          opportunity_id: string
          resume_url: string | null
          status: string
          student_email: string
          student_id: string | null
          student_name: string
          student_phone: string | null
        }
        Insert: {
          created_at?: string
          essay_responses?: Json | null
          id?: string
          opportunity_id: string
          resume_url?: string | null
          status?: string
          student_email: string
          student_id?: string | null
          student_name: string
          student_phone?: string | null
        }
        Update: {
          created_at?: string
          essay_responses?: Json | null
          id?: string
          opportunity_id?: string
          resume_url?: string | null
          status?: string
          student_email?: string
          student_id?: string | null
          student_name?: string
          student_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      bcs_autoresponder_log: {
        Row: {
          category: string
          gmail_message_id: string
          id: string
          responded_at: string
          sender_email: string
          subject: string | null
        }
        Insert: {
          category: string
          gmail_message_id: string
          id?: string
          responded_at?: string
          sender_email: string
          subject?: string | null
        }
        Update: {
          category?: string
          gmail_message_id?: string
          id?: string
          responded_at?: string
          sender_email?: string
          subject?: string | null
        }
        Relationships: []
      }
      clinic_files: {
        Row: {
          clinic_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          member_id: string | null
          mime_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          member_id?: string | null
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          member_id?: string | null
          mime_type?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_files_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_files_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          application_id: string | null
          clinic_id: string
          created_at: string
          email: string | null
          full_name: string
          hours_logged: number
          id: string
          join_date: string
          notes: string | null
          onboarding_source: string
          phone: string | null
          role_id: string | null
          status: string
          tracker_category_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          clinic_id: string
          created_at?: string
          email?: string | null
          full_name: string
          hours_logged?: number
          id?: string
          join_date?: string
          notes?: string | null
          onboarding_source?: string
          phone?: string | null
          role_id?: string | null
          status?: string
          tracker_category_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          clinic_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          hours_logged?: number
          id?: string
          join_date?: string
          notes?: string | null
          onboarding_source?: string
          phone?: string | null
          role_id?: string | null
          status?: string
          tracker_category_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "clinic_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_members_tracker_category_id_fkey"
            columns: ["tracker_category_id"]
            isOneToOne: false
            referencedRelation: "volunteer_tracker_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_roles: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          id: string
          role_name: string
          sort_order: number
        }
        Insert: {
          clinic_id: string
          color?: string
          created_at?: string
          id?: string
          role_name: string
          sort_order?: number
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          role_name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinic_roles_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_scheduling_questions: {
        Row: {
          clinic_id: string
          created_at: string
          display_order: number
          id: string
          is_required: boolean
          options: Json | null
          position_id: string | null
          question_text: string
          question_type: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          options?: Json | null
          position_id?: string | null
          question_text: string
          question_type?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          options?: Json | null
          position_id?: string | null
          question_text?: string
          question_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_scheduling_questions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_scheduling_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hospital_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_votes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          value: number
          votable_id: string
          votable_type: Database["public"]["Enums"]["votable_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          value: number
          votable_id: string
          votable_type: Database["public"]["Enums"]["votable_type"]
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          value?: number
          votable_id?: string
          votable_type?: Database["public"]["Enums"]["votable_type"]
        }
        Relationships: []
      }
      edge_function_rate_limits: {
        Row: {
          bucket: number
          count: number
          key: string
          updated_at: string
        }
        Insert: {
          bucket: number
          count?: number
          key: string
          updated_at?: string
        }
        Update: {
          bucket?: number
          count?: number
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_logs: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          metadata: Json | null
          recipient_count: number
          recipient_emails: string[]
          sent_by: string
          status: string
          subject: string
          template_id: string | null
          template_name: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          recipient_count?: number
          recipient_emails?: string[]
          sent_by: string
          status?: string
          subject: string
          template_id?: string | null
          template_name?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          recipient_count?: number
          recipient_emails?: string[]
          sent_by?: string
          status?: string
          subject?: string
          template_id?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_logs_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          category: string
          clinic_id: string
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          category: string
          clinic_id: string
          created_at?: string
          id?: string
          name: string
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          clinic_id?: string
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      experience_entries: {
        Row: {
          amcas_description: string | null
          created_at: string
          entry_date: string
          hours: number | null
          id: string
          moment: string | null
          opportunity_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amcas_description?: string | null
          created_at?: string
          entry_date?: string
          hours?: number | null
          id?: string
          moment?: string | null
          opportunity_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amcas_description?: string | null
          created_at?: string
          entry_date?: string
          hours?: number | null
          id?: string
          moment?: string | null
          opportunity_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_entries_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_entries_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          clinic_id: string | null
          created_at: string
          description: string | null
          enabled: boolean
          flag_key: string
          id: string
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key: string
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_key?: string
          id?: string
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feature_flags_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          converted_to_user_id: string | null
          created_at: string | null
          id: string
          session_id: string
          user_agent: string | null
        }
        Insert: {
          converted_to_user_id?: string | null
          created_at?: string | null
          id?: string
          session_id: string
          user_agent?: string | null
        }
        Update: {
          converted_to_user_id?: string | null
          created_at?: string | null
          id?: string
          session_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      hospital_accounts: {
        Row: {
          account_status: string
          admin_note: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          hospital_id: string
          id: string
          interview_booking_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          account_status?: string
          admin_note?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          hospital_id: string
          id?: string
          interview_booking_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          account_status?: string
          admin_note?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          hospital_id?: string
          id?: string
          interview_booking_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_accounts_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_application_answers: {
        Row: {
          answer_options: Json | null
          answer_text: string | null
          application_id: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          answer_options?: Json | null
          answer_text?: string | null
          application_id: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          answer_options?: Json | null
          answer_text?: string | null
          application_id?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_application_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "hospital_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_application_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "hospital_application_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_application_questions: {
        Row: {
          account_id: string
          created_at: string
          id: string
          options: Json | null
          order_index: number
          question_text: string
          required: boolean
          type: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          options?: Json | null
          order_index?: number
          question_text: string
          required?: boolean
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          options?: Json | null
          order_index?: number
          question_text?: string
          required?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_application_questions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "hospital_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_applications: {
        Row: {
          account_id: string
          applicant_email: string | null
          applicant_name: string | null
          id: string
          interview_confirmed_at: string | null
          interview_requested_at: string | null
          notes: string | null
          opportunity_id: string | null
          status: string
          student_id: string | null
          submitted_at: string
          updated_at: string
        }
        Insert: {
          account_id: string
          applicant_email?: string | null
          applicant_name?: string | null
          id?: string
          interview_confirmed_at?: string | null
          interview_requested_at?: string | null
          notes?: string | null
          opportunity_id?: string | null
          status?: string
          student_id?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          applicant_email?: string | null
          applicant_name?: string | null
          id?: string
          interview_confirmed_at?: string | null
          interview_requested_at?: string | null
          notes?: string | null
          opportunity_id?: string | null
          status?: string
          student_id?: string | null
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_applications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "hospital_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_deletion_log: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          deleted_hospital_id: string
          deleted_hospital_name: string | null
          duplicate_reason: string
          id: string
          kept_hospital_id: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_hospital_id: string
          deleted_hospital_name?: string | null
          duplicate_reason: string
          id?: string
          kept_hospital_id: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          deleted_hospital_id?: string
          deleted_hospital_name?: string | null
          duplicate_reason?: string
          id?: string
          kept_hospital_id?: string
        }
        Relationships: []
      }
      hospital_members: {
        Row: {
          account_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["hospital_role"]
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["hospital_role"]
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["hospital_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "hospital_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_pages: {
        Row: {
          admin_email: string
          claimed_at: string | null
          clone_version: number | null
          cloned_at: string | null
          cloned_from_page_id: string | null
          created_at: string
          created_by: string | null
          gmail_connected_at: string | null
          gmail_email: string | null
          gmail_refresh_token: string | null
          hospital_id: string
          id: string
          interview_booking_url: string | null
          is_claimed: boolean
          is_showcase: boolean
          page_status: string
        }
        Insert: {
          admin_email: string
          claimed_at?: string | null
          clone_version?: number | null
          cloned_at?: string | null
          cloned_from_page_id?: string | null
          created_at?: string
          created_by?: string | null
          gmail_connected_at?: string | null
          gmail_email?: string | null
          gmail_refresh_token?: string | null
          hospital_id: string
          id?: string
          interview_booking_url?: string | null
          is_claimed?: boolean
          is_showcase?: boolean
          page_status?: string
        }
        Update: {
          admin_email?: string
          claimed_at?: string | null
          clone_version?: number | null
          cloned_at?: string | null
          cloned_from_page_id?: string | null
          created_at?: string
          created_by?: string | null
          gmail_connected_at?: string | null
          gmail_email?: string | null
          gmail_refresh_token?: string | null
          hospital_id?: string
          id?: string
          interview_booking_url?: string | null
          is_claimed?: boolean
          is_showcase?: boolean
          page_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_pages_cloned_from_page_id_fkey"
            columns: ["cloned_from_page_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_pages_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_pages_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: true
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_positions: {
        Row: {
          application_deadline: string | null
          ask_for_availability: boolean
          created_at: string | null
          description: string | null
          duration: string | null
          hospital_page_id: string
          hours_per_week: number | null
          id: string
          location: string | null
          match_keywords: string[] | null
          position_type: string | null
          requirements: string | null
          spots_available: number | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          application_deadline?: string | null
          ask_for_availability?: boolean
          created_at?: string | null
          description?: string | null
          duration?: string | null
          hospital_page_id: string
          hours_per_week?: number | null
          id?: string
          location?: string | null
          match_keywords?: string[] | null
          position_type?: string | null
          requirements?: string | null
          spots_available?: number | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          application_deadline?: string | null
          ask_for_availability?: boolean
          created_at?: string | null
          description?: string | null
          duration?: string | null
          hospital_page_id?: string
          hours_per_week?: number | null
          id?: string
          location?: string | null
          match_keywords?: string[] | null
          position_type?: string | null
          requirements?: string | null
          spots_available?: number | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hospital_positions_hospital_page_id_fkey"
            columns: ["hospital_page_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          slug: string | null
          state: string | null
          status: string | null
          submitted_at: string | null
          submitted_by_user_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          slug?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          slug?: string | null
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by_user_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          checkpoint: Json
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          job_type: string
          locked_at: string | null
          params: Json
          started_at: string | null
          status: string
          summary: Json
          updated_at: string
        }
        Insert: {
          checkpoint?: Json
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          locked_at?: string | null
          params?: Json
          started_at?: string | null
          status?: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          checkpoint?: Json
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          locked_at?: string | null
          params?: Json
          started_at?: string | null
          status?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          id: string
          member_id: string
          notes: string | null
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          member_id: string
          notes?: string | null
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          member_id?: string
          notes?: string | null
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "clinic_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          clinic_id: string
          created_at: string
          description: string | null
          id: string
          sort_order: number
          step_name: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          step_name: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          step_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          acceptance_likelihood: Database["public"]["Enums"]["acceptance_likelihood"]
          address: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email: string | null
          external_id: string | null
          hospital_id: string | null
          hours_required: string
          id: string
          latitude: number | null
          location: string
          logo_url: string | null
          longitude: number | null
          name: string
          phone: string | null
          requirements: string[] | null
          slug: string | null
          source: string | null
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at: string
          website: string | null
        }
        Insert: {
          acceptance_likelihood: Database["public"]["Enums"]["acceptance_likelihood"]
          address?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          external_id?: string | null
          hospital_id?: string | null
          hours_required: string
          id?: string
          latitude?: number | null
          location: string
          logo_url?: string | null
          longitude?: number | null
          name: string
          phone?: string | null
          requirements?: string[] | null
          slug?: string | null
          source?: string | null
          type: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
          website?: string | null
        }
        Update: {
          acceptance_likelihood?: Database["public"]["Enums"]["acceptance_likelihood"]
          address?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email?: string | null
          external_id?: string | null
          hospital_id?: string | null
          hours_required?: string
          id?: string
          latitude?: number | null
          location?: string
          logo_url?: string | null
          longitude?: number | null
          name?: string
          phone?: string | null
          requirements?: string[] | null
          slug?: string | null
          source?: string | null
          type?: Database["public"]["Enums"]["opportunity_type"]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_questions: {
        Row: {
          body: string | null
          created_at: string
          id: string
          opportunity_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          opportunity_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          opportunity_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_questions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_questions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      person_notes: {
        Row: {
          body: string
          clinic_id: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          body: string
          clinic_id: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          clinic_id?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      position_questions: {
        Row: {
          char_limit: number | null
          created_at: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
          options: Json | null
          position_id: string
          question_text: string
          question_type: string
        }
        Insert: {
          char_limit?: number | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          options?: Json | null
          position_id: string
          question_text: string
          question_type: string
        }
        Update: {
          char_limit?: number | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          options?: Json | null
          position_id?: string
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_questions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hospital_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          career_goals: string | null
          certifications: string[] | null
          city: string | null
          clinical_hours: number | null
          created_at: string
          email_opt_in: boolean | null
          email_verified: boolean | null
          full_name: string
          gpa: number | null
          graduation_year: number | null
          id: string
          is_premium: boolean
          linkedin_url: string | null
          major: string | null
          onboarding_complete: boolean | null
          phone: string | null
          pre_med_track: string | null
          premium_expires_at: string | null
          research_experience: string | null
          resume_url: string | null
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          university: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          career_goals?: string | null
          certifications?: string[] | null
          city?: string | null
          clinical_hours?: number | null
          created_at?: string
          email_opt_in?: boolean | null
          email_verified?: boolean | null
          full_name: string
          gpa?: number | null
          graduation_year?: number | null
          id: string
          is_premium?: boolean
          linkedin_url?: string | null
          major?: string | null
          onboarding_complete?: boolean | null
          phone?: string | null
          pre_med_track?: string | null
          premium_expires_at?: string | null
          research_experience?: string | null
          resume_url?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          university?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          career_goals?: string | null
          certifications?: string[] | null
          city?: string | null
          clinical_hours?: number | null
          created_at?: string
          email_opt_in?: boolean | null
          email_verified?: boolean | null
          full_name?: string
          gpa?: number | null
          graduation_year?: number | null
          id?: string
          is_premium?: boolean
          linkedin_url?: string | null
          major?: string | null
          onboarding_complete?: boolean | null
          phone?: string | null
          pre_med_track?: string | null
          premium_expires_at?: string | null
          research_experience?: string | null
          resume_url?: string | null
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          university?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_answers: {
        Row: {
          body: string
          created_at: string
          id: string
          is_accepted: boolean | null
          question_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_accepted?: boolean | null
          question_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_accepted?: boolean | null
          question_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "opportunity_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_with_votes"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          remind_at: string
          sent: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          remind_at: string
          sent?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          remind_at?: string
          sent?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          acceptance_difficulty: number | null
          comment: string | null
          created_at: string
          id: string
          learning_opportunities: number | null
          opportunity_id: string
          overall_experience: number | null
          rating: number
          staff_friendliness: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acceptance_difficulty?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          learning_opportunities?: number | null
          opportunity_id: string
          overall_experience?: number | null
          rating: number
          staff_friendliness?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acceptance_difficulty?: number | null
          comment?: string | null
          created_at?: string
          id?: string
          learning_opportunities?: number | null
          opportunity_id?: string
          overall_experience?: number | null
          rating?: number
          staff_friendliness?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_opportunities: {
        Row: {
          applied: boolean | null
          contacted: boolean | null
          created_at: string
          deadline: string | null
          heard_back: boolean | null
          id: string
          is_active_experience: boolean | null
          notes: string | null
          opportunity_id: string
          scheduled_interview: boolean | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied?: boolean | null
          contacted?: boolean | null
          created_at?: string
          deadline?: string | null
          heard_back?: boolean | null
          id?: string
          is_active_experience?: boolean | null
          notes?: string | null
          opportunity_id: string
          scheduled_interview?: boolean | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied?: boolean | null
          contacted?: boolean | null
          created_at?: string
          deadline?: string | null
          heard_back?: boolean | null
          id?: string
          is_active_experience?: boolean | null
          notes?: string | null
          opportunity_id?: string
          scheduled_interview?: boolean | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_answers: {
        Row: {
          answer_options: Json | null
          answer_text: string | null
          application_id: string
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          answer_options?: Json | null
          answer_text?: string | null
          application_id: string
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          answer_options?: Json | null
          answer_text?: string | null
          application_id?: string
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "clinic_scheduling_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_applications: {
        Row: {
          applicant_email: string | null
          applicant_name: string | null
          availability_json: Json | null
          id: string
          interview_confirmed_at: string | null
          interview_invited_at: string | null
          interview_source: string | null
          notes: string | null
          position_id: string
          resume_match_score: number | null
          resume_text: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          applicant_email?: string | null
          applicant_name?: string | null
          availability_json?: Json | null
          id?: string
          interview_confirmed_at?: string | null
          interview_invited_at?: string | null
          interview_source?: string | null
          notes?: string | null
          position_id: string
          resume_match_score?: number | null
          resume_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          applicant_email?: string | null
          applicant_name?: string | null
          availability_json?: Json | null
          id?: string
          interview_confirmed_at?: string | null
          interview_invited_at?: string | null
          interview_source?: string | null
          notes?: string | null
          position_id?: string
          resume_match_score?: number | null
          resume_text?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hospital_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan_type: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan_type?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          page_url: string
          referrer_url: string | null
          screen_height: number | null
          screen_width: number | null
          session_id: string
          timezone: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          page_url: string
          referrer_url?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id: string
          timezone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          page_url?: string
          referrer_url?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id?: string
          timezone?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          impact: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          impact?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volunteer_tracker_categories: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          clinic_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_tracker_categories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_tracker_columns: {
        Row: {
          clinic_id: string
          column_type: Database["public"]["Enums"]["volunteer_tracker_column_type"]
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          clinic_id: string
          column_type?: Database["public"]["Enums"]["volunteer_tracker_column_type"]
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          clinic_id?: string
          column_type?: Database["public"]["Enums"]["volunteer_tracker_column_type"]
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_tracker_columns_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_tracker_entries: {
        Row: {
          category_id: string
          clinic_id: string
          created_at: string
          id: string
          sort_order: number
          volunteer_name: string
          volunteer_user_id: string | null
        }
        Insert: {
          category_id: string
          clinic_id: string
          created_at?: string
          id?: string
          sort_order?: number
          volunteer_name: string
          volunteer_user_id?: string | null
        }
        Update: {
          category_id?: string
          clinic_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          volunteer_name?: string
          volunteer_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_tracker_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "volunteer_tracker_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_tracker_entries_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_tracker_values: {
        Row: {
          column_id: string
          entry_id: string
          id: string
          value: string | null
        }
        Insert: {
          column_id: string
          entry_id: string
          id?: string
          value?: string | null
        }
        Update: {
          column_id?: string
          entry_id?: string
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_tracker_values_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "volunteer_tracker_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_tracker_values_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "volunteer_tracker_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_settings: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          is_open: boolean
          slug: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          is_open?: boolean
          slug: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          is_open?: boolean
          slug?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_settings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: true
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_submissions: {
        Row: {
          availability_json: Json | null
          clinic_id: string
          converted_at: string | null
          converted_to_application_id: string | null
          email: string
          full_name: string
          gpa: number | null
          graduation_year: number | null
          id: string
          major: string | null
          message: string | null
          phone: string | null
          role_interest: string | null
          submitted_at: string
          university: string | null
          waitlist_id: string | null
        }
        Insert: {
          availability_json?: Json | null
          clinic_id: string
          converted_at?: string | null
          converted_to_application_id?: string | null
          email: string
          full_name: string
          gpa?: number | null
          graduation_year?: number | null
          id?: string
          major?: string | null
          message?: string | null
          phone?: string | null
          role_interest?: string | null
          submitted_at?: string
          university?: string | null
          waitlist_id?: string | null
        }
        Update: {
          availability_json?: Json | null
          clinic_id?: string
          converted_at?: string | null
          converted_to_application_id?: string | null
          email?: string
          full_name?: string
          gpa?: number | null
          graduation_year?: number | null
          id?: string
          major?: string | null
          message?: string | null
          phone?: string | null
          role_interest?: string | null
          submitted_at?: string
          university?: string | null
          waitlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_submissions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_submissions_converted_to_application_id_fkey"
            columns: ["converted_to_application_id"]
            isOneToOne: false
            referencedRelation: "student_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_submissions_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlists"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlists: {
        Row: {
          clinic_id: string
          created_at: string
          description: string
          id: string
          position_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          description: string
          id?: string
          position_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          description?: string
          id?: string
          position_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlists_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "hospital_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlists_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hospital_positions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      answers_with_votes: {
        Row: {
          author_clinical_hours: number | null
          author_graduation_year: number | null
          author_major: string | null
          author_name: string | null
          author_university: string | null
          body: string | null
          created_at: string | null
          id: string | null
          is_accepted: boolean | null
          question_id: string | null
          updated_at: string | null
          user_id: string | null
          vote_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "opportunity_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_with_votes"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities_with_ratings: {
        Row: {
          acceptance_likelihood:
            | Database["public"]["Enums"]["acceptance_likelihood"]
            | null
          address: string | null
          avg_rating: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email: string | null
          hospital_id: string | null
          hours_required: string | null
          id: string | null
          latitude: number | null
          location: string | null
          logo_url: string | null
          longitude: number | null
          name: string | null
          phone: string | null
          requirements: string[] | null
          review_count: number | null
          slug: string | null
          source: string | null
          type: Database["public"]["Enums"]["opportunity_type"] | null
          updated_at: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          clinical_hours: number | null
          full_name: string | null
          graduation_year: number | null
          id: string | null
          major: string | null
          university: string | null
        }
        Insert: {
          clinical_hours?: number | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string | null
          major?: string | null
          university?: string | null
        }
        Update: {
          clinical_hours?: number | null
          full_name?: string | null
          graduation_year?: number | null
          id?: string | null
          major?: string | null
          university?: string | null
        }
        Relationships: []
      }
      questions_with_votes: {
        Row: {
          answer_count: number | null
          author_clinical_hours: number | null
          author_graduation_year: number | null
          author_major: string | null
          author_name: string | null
          author_university: string | null
          body: string | null
          created_at: string | null
          id: string | null
          opportunity_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          vote_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_questions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_questions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities_with_ratings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_admin_by_email: { Args: { admin_email: string }; Returns: boolean }
      calculate_distance_miles: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      cleanup_unverified_accounts: { Args: never; Returns: undefined }
      count_opportunities: {
        Args: { filter_type?: string; search_term?: string }
        Returns: number
      }
      delete_user_account: { Args: never; Returns: undefined }
      deploy_hospital_opportunity: {
        Args: { p_hospital_id: string }
        Returns: string
      }
      get_opportunities_by_distance: {
        Args: {
          filter_type?: string
          max_distance_miles?: number
          page_limit?: number
          page_offset?: number
          search_term?: string
          user_lat: number
          user_lon: number
        }
        Returns: {
          acceptance_likelihood: string
          address: string
          avg_rating: number
          description: string
          distance_miles: number
          email: string
          hours_required: string
          id: string
          latitude: number
          location: string
          logo_url: string
          longitude: number
          name: string
          phone: string
          requirements: string[]
          review_count: number
          type: string
          website: string
        }[]
      }
      get_user_hospital_account_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hospital_confirm_interview_ha: {
        Args: { p_application_id: string; p_slot: string }
        Returns: undefined
      }
      hospital_list_applications: {
        Args: { p_hospital_id: string; p_sort_by?: string; p_sort_dir?: string }
        Returns: {
          created_at: string
          essay_responses: Json
          gpa: number
          id: string
          opportunity_id: string
          resume_url: string
          status: string
          student_email: string
          student_id: string
          student_name: string
          student_phone: string
        }[]
      }
      hospital_request_interview_ha: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      is_super_admin: { Args: never; Returns: boolean }
      link_opportunity_to_hospital: {
        Args: { p_hospital_id: string; p_opportunity_id: string }
        Returns: undefined
      }
      reserve_edge_rate_limit: {
        Args: {
          p_delta?: number
          p_key: string
          p_max: number
          p_window_seconds: number
        }
        Returns: Json
      }
      reserve_gmail_send_limits: {
        Args: {
          p_delta: number
          p_hospital_page_id: string
          p_max_day?: number
          p_max_hour?: number
        }
        Returns: Json
      }
      seed_default_clinic_roles: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      seed_default_onboarding_steps: {
        Args: { p_clinic_id: string }
        Returns: undefined
      }
      submit_guest_hospital_application: {
        Args: {
          p_account_id: string
          p_answers: Json
          p_email: string
          p_name: string
          p_opportunity_id?: string
          p_student_id?: string
        }
        Returns: string
      }
    }
    Enums: {
      acceptance_likelihood: "high" | "medium" | "low"
      app_role: "admin" | "moderator" | "user"
      hospital_role: "owner" | "admin" | "viewer"
      opportunity_type: "hospital" | "clinic" | "hospice" | "emt" | "volunteer"
      volunteer_tracker_column_type:
        | "number"
        | "percentage"
        | "rating_1_5"
        | "text"
        | "boolean"
      votable_type: "question" | "answer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acceptance_likelihood: ["high", "medium", "low"],
      app_role: ["admin", "moderator", "user"],
      hospital_role: ["owner", "admin", "viewer"],
      opportunity_type: ["hospital", "clinic", "hospice", "emt", "volunteer"],
      volunteer_tracker_column_type: [
        "number",
        "percentage",
        "rating_1_5",
        "text",
        "boolean",
      ],
      votable_type: ["question", "answer"],
    },
  },
} as const
