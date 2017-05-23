import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpModule } from '@angular/http';
import { RouterModule, Routes } from '@angular/router';
import { AppRoutingModule } from './app-routing.module';

import { AppComponent } from './app.component';
import { ApplicationNoncommercialGroupComponent } from './application-noncommercial-group/application-noncommercial-group.component';
import { ApplicationNoncommercialGroupService } from './application-noncommercial-group/application-noncommercial-group-service';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { PermitApplicationListComponent } from './permit-application-list/permit-application-list.component';
import { PermitApplicationViewComponent } from './permit-application-view/permit-application-view.component';
import { PgFlowStep1Component } from './pg-flow-step-1/pg-flow-step-1.component';
import { PgFlowStep2Component } from './pg-flow-step-2/pg-flow-step-2.component';
import { PgFlowRegPersonComponent } from './pg-flow-reg-person/pg-flow-reg-person.component';
import { PgFlowRegPersonFriendFamilyComponent } from './pg-flow-reg-person-friend-family/pg-flow-reg-person-friend-family.component';
import { ApplicationSubmittedComponent } from './application-submitted/application-submitted.component';

@NgModule({
  declarations: [
    AppComponent,
    ApplicationNoncommercialGroupComponent,
    HomeComponent,
    LoginComponent,
    PermitApplicationListComponent,
    PermitApplicationViewComponent,
    PgFlowStep1Component,
    PgFlowStep2Component,
    PgFlowRegPersonComponent,
    PgFlowRegPersonFriendFamilyComponent,
    ApplicationSubmittedComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpModule,
    AppRoutingModule
  ],
  providers: [ApplicationNoncommercialGroupService],
  bootstrap: [AppComponent]
})

export class AppModule { }
